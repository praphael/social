const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path'); // Require the path module
const sha256 = require('js-sha256');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret';
const db = require('./db.js');
const cors = require('cors');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the public directory
app.use(cors());

startTime = Date.now();

const curDateStr = () => {
    return new Date(Date.now()).toLocaleString();
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        console.log(curDateStr(), " verifyToken no token");
        // return res.status(401).send('Unauthorized: No token provided');
        req.userID = 0;
    }
    else {
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                console.log(curDateStr(), `verifyToken invalid token ${token}`);
                req.userID = 0;
            // return res.status(401).send('Unauthorized: Invalid token');
            } else {
                req.userID = decoded.id;
                
            }
        });
    }
    next();
};

function parseIntOrFail(x, paramName, isRequired, endpt, res) {
    if (x != undefined && x != null) {
        try { 
            x = parseInt(x); 
            return x;
        }
        catch(e) {
            res.status(400).send(`${endpt} failed integer parse of '${paramName}' (got '${x}')`);
            return false;
        }
    } else if(isRequired) {
        res.status(400).send(`${endpt} '${paramName}' missing`);
        return false;
    }
    return null;
}

// Route for user login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(curDateStr(), `login username=${username}`);
        const ipaddr = req.ip;
        const users = await db.sql`SELECT userid, passhash FROM users WHERE username=${ username }`;
        // console.log(`login users= ${JSON.stringify(users)}`);
        if (users.length > 0 && (sha256(password) == users[0].passhash)) {
            const userID = users[0].userid;
            //console.log(`userID= ${userID}`);
            const token = jwt.sign({ id: userID }, JWT_SECRET, { expiresIn: '1h' });
            try {
                const logininfo = { userid:userID, ipaddr:ipaddr };
                await db.sql`INSERT INTO logins
                    ${db.sql(logininfo, 'userid', 'ipaddr')}`;
                // console.log(`user ${username} userID=${userID} logged in token= ${token}`);
                return res.status(200).json({ token, userID });
            } catch(e) {
                const msg = "login failure: " + e;
                console.log(msg);
                return res.status(500).send(msg);
            }
        } else {
            console.log("Invalid login from '" + username + "'");
            return res.status(401).send('Invalid username or password');
        }
    } catch(e) {
        console.log("Error during login", e);
        return res.status(500).send('login error: ' + e);
    }
});

// Route for two factor auth
app.post('/auth2fa', async (req, res) => {

});

// registration route
app.post('/register', async (req, res) => {
    try {
        console.log(curDateStr(), "/register POST req.params='", req.params, "'");
        const { username, password, password2, email, auth2fa } = req.body;
    
        if(password != password2) {
            return res.status(400).send('Passwords do not match');
        }
        const ipaddr = req.ip;
        const newuser = { username:username, passhash:sha256(password),
                      email:email, ipaddr:ipaddr, auth2fa:auth2fa };
    
        await db.sql`INSERT INTO users
            ${db.sql(newuser, 'username', 'passhash', 'email', 'ipaddr', 'auth2fa')}`;
        return res.status(201).send("OK");
    } catch(e) {
        console.log("/register error ", e)
        return res.status(500).send('SQL insert error: ' + e);
    }
});

// Route to create a new post
app.post('/posts', verifyToken, async (req, res) => {
    try {
        if(req.userID == 0) return res.status(401).send("Valid login required");
        console.log(curDateStr(), "/posts POST req.params= '", req.params, "' req.body='", req.body, "'");
        if(!req.body.hasOwnProperty("msgbody"))
            return res.status(500).send("/posts POST 'msgbody' must be defined");
        const msgbody = req.body.msgbody;
        if(msgbody === "")
            return res.status(500).send("/posts POST 'msgbody' must not be blank");

        let visibility = parseIntOrFail(req.body.visibility, 'visibility', false, '/posts POST', res);
        if(visibility === false) return;
        else if(visibility === null) visibility = 2;

        let replyid = parseIntOrFail(req.body.replyid, 'replyid', false, '/posts POST', res);
        // return on failure (status already set)
        // replyid was present but parsed failed
        if(replyid === false) return;
        
        // required if we successfully parsed replyid, otherwise not required
        const isRequired = (replyid != null);
        const replyid_top_level = parseIntOrFail(req.body.replyid_top_level, 
            'replyid_top_level', isRequired, '/posts POST', res);
        // return on failure (status already set)
        if(replyid_top_level === false) return;
        // or if parse of origreplyid succeeded and replyid did not 
        if(replyid_top_level != null && replyid === null) {
            const msg = `'replyid_top_level'='${replyid_top_level}' and 'replyid'='${replydid}' 
            must both be present and valid or both not present in request`;
            return res.status(400).send(msg);
        }
        
        const ipaddr = req.ip;
        const tm = Date.now();
        console.log("posts tm=", tm);
        let r = null;
        await db.sql.begin(async (sql) => {
            await sql`INSERT INTO posts (authorid, tm, body, ipaddr, replyid_top_level, replyid, 
                visibility, replies, replies_top_level, score)
                VALUES(${req.userID}, to_timestamp(${tm/1000}), ${msgbody}, ${ipaddr},
                ${replyid_top_level}, ${replyid}, ${visibility}, 0, 0, 0)`;
            r = await sql`SELECT postid FROM posts WHERE authorid=${req.userID} AND tm=to_timestamp(${tm/1000})`;
            if(replyid != null) {
                await sql`UPDATE posts SET replies=replies+1 WHERE postid=${replyid}`;
                await sql`UPDATE posts SET replies_top_level=replies_top_level+1 WHERE postid=${replyid_top_level}`;
            }
        });
        
        return res.status(201).json({postid:r[0].postid, tm: tm});
    } catch(e) {
        console.log("/posts error ", e);
        return res.status(500).send("messages error: " + e);
    }
    // return res.status(201).json(message);
});

// fetch post based on postid
// TODO need to validate user allowed to fetch post
app.get('/posts/:postid', verifyToken, async (req, res) => {
    try {
        console.log(curDateStr(), "/posts GET req.params= '", req.params, "' req.query= '", req.query, "'");
        // if(req.userID == 0) return res.status(401).send("Valid login required");
        const postID = parseIntOrFail(req.params.postid, 'postid', true, '/posts', res);
        if(postID == false) return;
        const tm = Date.now();
        // TODO only allow query if userID is subscribed
        const r = await db.sql`SELECT a.postid, a.authorid, b.username, 
            trunc(1000*extract(epoch from tm)) as tm, 
            trunc(1000*extract(epoch from tm_last_body_edit)) as tm_last_body_edit, 
            a.body, a.score, a.replies as numreplies, a.replies_top_level as numreplies_top_level
            FROM posts a
            LEFT JOIN users b ON a.authorid=b.userid
            WHERE a.postid=${postID}`
        
        return res.status(200).json({post:r[0], lastupdate:tm});
    } catch(e) {
        console.log("/posts GET error ", e);
        return res.status(500).send("posts GET error: " + e);
    }
});

// update post (edit body)
app.patch('/posts/:postid', verifyToken, async (req, res) => {
    try {
        console.log(curDateStr(), "/posts PATCH req.params= '", req.params, "' req.body='", req.body, "'");
        const postID = parseIntOrFail(req.params.postid, 'postid', true, '/posts', res);
        if(postID == false) return;
        if(!req.body.hasOwnProperty("msgbody"))
            return res.status(500).send("/posts PATCH 'msgbody' must be defined");
        const msgbody = req.body.msgbody;
        if(msgbody === "")
            return res.status(500).send("/posts PATCH 'msgbody' must not be blank");
        
        const tm = Date.now();
        // TODO only allow query if userID is subscribed
        const r = await db.sql`UPDATE posts SET body=${msgbody}, 
                    tm_last_body_edit=to_timestamp(${tm/1000})
                    WHERE postid=${postID}`;
        return res.status(200).json({postid:postID, lastupdate:tm});
    } catch(e) {
        console.log("/posts PATCH error ", e);
        return res.status(500).send("posts PATCH error: " + e);
    }

});

// get "delta of post" - body if modified since last edit, and # of votes/replies
// TODO need to validate user allowed to fetch post
app.get('/postdelta/:postid', verifyToken, async (req, res) => {
    try {
        console.log(curDateStr(), "/postdelta GET req.params= '", req.params, "' req.query= '", req.query, "'");
        // if(req.userID == 0) return res.status(401).send("Valid login required");
        const postID = parseIntOrFail(req.params.postid, 'postid', true, '/postdelta', res);
        if(postID == false) return;
        const lastUpdate = parseIntOrFail(req.query.lastupdate, 'lastupdate', true, '/postdelta', res);
        if(lastUpdate == false) return;

        const tm = Date.now();
        // TODO only allow query if userID is subscribed
        const r = await db.sql`SELECT a.postid,
            trunc(1000*extract(epoch from tm_last_body_edit)) as tm_last_body_edit,
            a.body, a.score, a.replies, a.replies_top_level
            FROM posts a
            WHERE a.postid=${postID}`;
        let msg_info = {score:r[0].score, numreplies:r[0].replies, numreplies_top_level:r[0].replies_top_level};
        const lastedit_tm = r[0].tm_last_body_edit;
        if(lastedit_tm != null && lastedit_tm > lastUpdate)
            msg_info = {...msg_info, body:r[0].body};
        console.log("msg_info=", msg_info);
        return res.status(200).json({msg:msg_info, lastupdate:tm});
    } catch(e) {
        console.log("/postdelta GET error ", e);
        return res.status(500).send("postsdelta GET error: " + e);
    }
});

async function doGetReplies(isAll, rt, req, res) {
    try {
        console.log(curDateStr(), rt, "GET req.params= '", req.params, "' req.query= '", req.query, "'");
        // if(req.userID == 0) return res.status(401).send("Valid login required");
        const postID = parseIntOrFail(req.params.postid, 'postid', true, rt, res);
        if(postID == false) return;
        const nDays = 60;
        // last update time
        let lastupdate = parseIntOrFail(req.query.lastupdate, 'lastupdate', false, '/feed', res);
        if(lastupdate == false) // failed parse
            return;
        if(lastupdate == null)
            lastupdate = Date.now() - 1000*60*60*24*nDays

        // for getting older posts
        let olderthan = parseIntOrFail(req.query.olderthan, 'olderthan', false, '/feed', res);
        if(olderthan == false) // failed parse
            return;

        const messagesLimit = 200;
        const tm = Date.now();
        // TODO only allow query if userID is subscribed
        let qyIsAll = db.sql` WHERE a.replyid=${postID}`;
        if(isAll)
            qyIsAll = db.sql` WHERE a.replyid_top_level=${postID}`;
        let qyTm = db.sql` AND a.tm > (${lastupdate/1000})`;
        if(olderthan != null)
            qyTm = db.sql` AND a.tm < (${olderthan/1000})`;
        let qyVisib = db.sql`AND visibility > 0`;
        if(req.userID == 0)
            db.sql` AND visibility > 2`;

        const r = await db.sql`SELECT a.postid, a.authorid, b.username, 
            trunc(1000*extract(epoch from tm)) as tm, 
            a.body, a.score, a.replies as numreplies, a.replies_top_level as numreplies_top_level
            FROM posts a
            LEFT JOIN users b ON a.authorid=b.userid
            ${qyIsAll}
            ${qyTm}
            ${qyVisib}
            LIMIT ${messagesLimit}`;
        
        return res.status(200).json({replies:r, lastupdate:tm});
    } catch(e) {
        console.log(rt, "GET error ", e);
        return res.status(500).send(rt + "GET error: " + e);
    }

}
// get all replies to top-level post
app.get('/repliesall/:postid', verifyToken, async (req, res) => {
    doGetReplies(true, '/repliesall', req, res);
});

// get replies to post
app.get('/replies/:postid', verifyToken, async (req, res) => {
    doGetReplies(false, '/replies', req, res);
});

// delete post
app.delete('/posts/:postid', verifyToken, async (req, res) => {
    console.log(curDateStr(), "/posts DELETE req.params= '", req.params, "' req.query= '", req.query, "'");
    if(req.userID == 0) return res.status(401).send("Valid login required");
    const postID = parseIntOrFail(req.params.postid, 'postid', true, '/posts', res);
    if(postID == false) return;
    try {
        await db.sql`DELETE FROM posts WHERE postid=${postID} AND authorid=${req.userID}`;
        return res.status(200).json({postid:postID});
    } catch(e) {
        console.log("/posts DELETE error ", e);
        return res.status(500).send("posts DELETE error: " + e);
    }
});

// Route to remove subscription 
app.delete('/subs/:subid', verifyToken, async (req, res) => {
    try {
        if(req.userID == 0) return res.status(401).send("Valid login required");
        console.log(curDateStr(), "/subs DELETE req.params='", req.params, "'");
        const subID = parseIntOrFail(req.params.subid, 'subid', true, '/subs DELETE', res);
        if(subID === false) return;
        if (req.userID === subID) {
            return res.status(400).send('Cannot unsubscribe from yourself');
        }
        await db.sql`DELETE FROM usersubs WHERE userid=${req.userID} AND subid=${subID}`
        return res.status(200).json({subid:subID});
    } catch(e) {
        console.log("/subscribe (DELETE) error ", e)
        return res.status(500).send('SQL DELETE error: ' + e);
    }
});

// Route to subscribe to another user
app.post('/subs/:subid', verifyToken, async (req, res) => {
    try {
        if(req.userID == 0) return res.status(401).send("Valid login required");
        console.log(curDateStr(), "/subs POST req.params='", req.params, "'");
        const userID = req.userID;
        const subID = parseIntOrFail(req.params.subid, 'subid', true, '/subs', res);
        if (subID === false) return;

        if (userID === subID) {
            return res.status(400).send('Cannot subscribe to yourself');
        }
        const usersub = { userid:userID, subid:subID };
        
        await db.sql`INSERT INTO usersubs 
            ${db.sql(usersub, 'userid', 'subid')}`;
            return res.status(201).json(usersub);
    } catch(e) {
        console.log("/subscribe error ", e)
        return res.status(500).send('SQL INSERT error: ' + e);
    }
});

// get list of subscriptions, or users to which user is not subscribed
app.get('/subs', verifyToken, async (req, res) => {
    try {
        if(req.userID == 0) return res.status(401).send("Valid login required");
        console.log(curDateStr(), "/subs GET req.query='", req.query, "'");
        const mode = req.query.mode;
        if(!(mode === 'subs' || mode === 'notsubs')) {
            return res.status(500).send(`'mode' must be either 'subs' or 'notsubs' got '${mode}'`);
        }
        const userUnsubLimit = 30;
        const userSubLimit = 500;
        
        let users=null;
        // get all subs for this user
        if (mode === 'subs') {
            users = await db.sql`SELECT userid, username FROM users
            WHERE userid IN (SELECT subid FROM usersubs WHERE userid=${req.userID})
            AND userid!=${req.userID}
            LIMIT ${userSubLimit}`;
        }
        else { // (mode === 'notsubs')
            users = await db.sql`SELECT userid, username FROM users
            WHERE userid NOT IN (SELECT subid FROM usersubs WHERE userid=${req.userID})
            AND userid!=${req.userID}
            LIMIT ${userUnsubLimit}`;
        }
        return res.status(200).json({users:users});
    } catch(e) {
        console.log(e);
        return res.status(500).send('user list generation error: ' + e);
    }
});

// Route to get user's feed
app.get('/feed', verifyToken, async (req, res) => {
    try {
        console.log(curDateStr(), "/feed GET req.query='", req.query, "'");
        // if(req.userID == 0) return res.status(401).send("Valid login required");
        const nDays = 60;
        const messagesLimit = 10;
        // last update time
        let lastupdate = parseIntOrFail(req.query.lastupdate, 'lastupdate', false, '/feed', res);
        if(lastupdate == false) // failed parse
            return;
        if(lastupdate == null)
            lastupdate = Date.now() - 1000*60*60*24*nDays

        // for getting older posts
        let olderthan = parseIntOrFail(req.query.olderthan, 'olderthan', false, '/feed', res);
        if(olderthan == false) // failed parse
            return;

        let qyTm = db.sql`AND a.tm > to_timestamp(${lastupdate/1000})`;
        if (olderthan != null) {
            qyTm = db.sql`AND a.tm < to_timestamp(${olderthan/1000})`;
        }
        
        let qyAuth = db.sql`a.authorid IN (SELECT subid FROM usersubs WHERE userid=${req.userID})`
        if(req.userID == 0)
            qyAuth = `a.visibility > 2`;
      
        const messageFeed = await db.sql`SELECT a.postid, a.authorid, b.username, 
                    trunc(1000*extract(epoch from a.tm)) as tm, a.body, a.score,
                    a.replies_top_level as numreplies_top_level, a.replies as numreplies
                FROM posts a 
                LEFT JOIN users b ON a.authorid=b.userid 
                WHERE ${qyAuth}
                    AND (a.replyid=0::bigint OR a.replyid IS NULL)
                ${qyTm}
                ORDER BY tm DESC LIMIT ${messagesLimit}`;
        tm = Date.now();
        console.log("messageFeed.length= ", messageFeed.length);

        return res.status(200).json({feed:messageFeed, lastupdate:tm});
    } catch(e) {
        console.log(e);
        return res.status(500).send('feed generation error: ' + e);
    }
});

app.post('/vote/:postid', verifyToken, async (req, res) => {
    try {
        if(req.userID == 0) return res.status(401).send("Valid login required");
        console.log(curDateStr(), "/vote POST req.params='", req.params, "' req.query='", req.query, "'");
        const postid = parseIntOrFail(req.params.postid, 'postid', true, '/vote POST', res);
        if (postid === false) return;
        const score = parseIntOrFail(req.query.score, 'score', true, '/vote POST', res);
        if (score === false) return;
        // TODO should not be able to vote on your own post
        await db.sql.begin(async (sql) => {
            await sql`INSERT INTO votes (postid, voterid, score)
                VALUES(${postid}, ${req.userID}, ${score})`;
            await sql`UPDATE posts SET score=score+${score} WHERE postid=${postid}`;
        });
        
        return res.status(201).json({postid, score});
    } catch(e) {
        console.log("/vote error ", e)
        return res.status(500).send("vote error: " + e);
    }
});

app.delete('/vote/:postid', verifyToken, async (req, res) => {
    try {
        if(req.userID == 0) return res.status(401).send("Valid login required");
        console.log(curDateStr(), "/vote DELETE req.params='", req.params, "' req.query='", req.query, "'");
        const postid = parseIntOrFail(req.params.postid, 'postid', true, '/vote DELETE', res);
        if (postid === false) return;
        await db.sql.begin(async (sql) => {
            const r = await sql`SELECT score FROM votes WHERE postid=${postid} 
                AND voterid=${req.userID}`;
            const score = r[0].score;
            await sql`DELETE FROM votes WHERE postid=${postid} 
                AND voterid=${req.userID}`;
            await sql`UPDATE posts SET score=score-${score} WHERE postid=${postid}`;
        });
        return res.status(200).json({postid});
    } catch(e) {
        console.log("/vote error ", e)
        return res.status(500).send("vote error: " + e);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
