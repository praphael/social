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
        next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log(curDateStr(), `verifyToken invalid token ${token}`);
            req.userID = 0;
            next();
            // return res.status(401).send('Unauthorized: Invalid token');
        } else {
            req.userID = decoded.id;
            next();
        }
    });
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
        msgbody = req.body.msgbody;
        replyid = parseIntOrFail(req.body.replyid, 'replyid', false, '/posts POST', res);
        // return on failure (status already set)
        // replyid was present but parsed failed
        if(replyid === false) return;
        
        // required if we successfully parsed replyid, otherwie not required
        const isRequired = (replyid != null);
        origreplyid = parseIntOrFail(req.body.origreplyid, 'origreplyid', isRequired, '/posts POST', res);
        // return on failure (status already set)
        if(origreplyid === false) return;
        // or if parse of origreplyid succeeded and replyid did not 
        if(origreplyid != null && replyid === null) {
            const msg = `'origreplyid'='${origreplyid}' and 'replyid'='${replydid}' 
            must both be present and valid or both not present in request`;
            return res.status(400).send(msg);
        }
        
        const ipaddr = req.ip;
        const tm = Date.now();
        console.log("posts tm=", tm);
    
        await db.sql`INSERT INTO posts (authorid, tm, body, ipaddr, origreplyid, replyid)
            VALUES(${req.userID}, to_timestamp(${tm/1000}), ${msgbody}, ${ipaddr},
            ${origreplyid}, ${replyid})`;
        return res.status(201).json({tm: tm});
    } catch(e) {
        console.log("/posts error ", e);
        return res.status(500).send("messages error: " + e);
    }
    // return res.status(201).json(message);
});

// fetch user posts based on timestamp
app.get('/posts/:authorID/:tm', verifyToken, async (req, res) => {
    try {
        if(req.userID == 0) return res.status(401).send("Valid login required");
        console.log(curDateStr(), "/posts GET req.params='", req.params, "'");
        const postsLimit=100;
        let {authorID, tm} = req.params;
        tm = parseIntOrFail(tm, 'tm', true, '/posts GET', res);
        authorID = parseIntOrFail(authorID, 'authorID', true, '/posts GET', res);
        console.log(`/posts authorID=${authorID} tm=${tm}`);
        if(!(authorID == 0 || authorID == req.userID)) {
            return res.status(400).send("/posts GET only authorID==0 or authorID==req.userID supported for now!");
        }
        authorID = req.userID;
        
        const r = await db.sql`SELECT * FROM posts WHERE authorid=${authorID} 
            AND tm>=to_timestamp(${tm/1000}) LIMIT ${postsLimit}`;
        return res.status(200).json({posts:r});
    } catch(e) {
        console.log("/posts GET error ", e);
        return res.status(500).send("posts GET error: " + e);
    }
});

// fetch replies based on postid
app.get('/replies/:postid', verifyToken, async (req, res) => {
    try {
        console.log(curDateStr(), "/replies GET req.params= '", req.params, "' req.query= '", req.query, "'");
        const postID = parseIntOrFail(req.params.postid, 'postid', true, '/replies', res);
        if(postID == false) return;
        let tm1 = parseIntOrFail(req.query.tmlow, 'tmlow', false, '/replies GET', res);
        let tm2 = parseIntOrFail(req.query.tmhigh, 'tmhigh', false, '/replies GET', res);
        if(tm1 == null) tm1 = 0;
        if(tm2 == null) tm2 = Date.now();
        const messagesLimit = 200;
        // TODO only allow query if userID is subscribed
        const r = await db.sql`WITH cte1 as 
            (SELECT a.postid, a.authorid, c.username, a.tm, a.body, sum(score) AS score
            FROM posts a
            LEFT JOIN votes b ON a.postid=b.postid
            LEFT JOIN users c ON a.authorid=c.userid
            WHERE a.replyid=${postID}
            AND a.tm BETWEEN to_timestamp(${tm1/1000}) AND to_timestamp(${tm2/1000})
            GROUP BY a.postid, a.authorid, c.username, a.tm LIMIT ${messagesLimit})
        SELECT a.postid, a.authorid, a.username AS author, trunc(1000*extract(epoch from a.tm)) as tm,
            a.body, a.score, count(b.origreplyid) AS numreplies
        FROM cte1 a
        LEFT JOIN posts b ON a.postid=b.replyid
        GROUP BY a.postid, a.authorid, author, a.tm, a.score, a.body
        ORDER BY tm DESC`
        return res.status(200).json({posts:r});
    } catch(e) {
        console.log("/posts GET error ", e);
        return res.status(500).send("posts GET error: " + e);
    }
});

// Route to remove subscription 
app.delete('/subs/:subid',  verifyToken, async (req, res) => {
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

// get list of users, to which user is either or not subscribed
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
        if(req.userID == 0) return res.status(401).send("Valid login required");
        const nDays = 60;
        const messagesLimit = 10;
        // last update time
        let lastupdate = Date.now() - 1000*60*60*24*nDays
        if (req.query.hasOwnProperty("lastupdate")) {
            try {
                lastupdate = parseInt(req.query.lastupdate);
            } catch(e) {
                return res.status(400).send(`Could not parse 'lastupdate' ${lastupdate}`);
            }
        }
        // const username = req.params.username;
        const userID = req.userID;
        console.log(`feed userID='${userID}' lastupdate=${lastupdate}`);
        let messageFeed=null;
        if(req.userID != 0) {
            messageFeed = await db.sql`WITH cte1 as 
            (SELECT a.postid, a.authorid, c.username, a.tm, a.body, sum(score) AS score
             FROM posts a 
             LEFT JOIN votes b ON a.postid=b.postid 
             LEFT JOIN users c ON a.authorid=c.userid 
             WHERE a.authorid IN (SELECT subid FROM usersubs WHERE userid=${userID}) 
                 AND a.origreplyid IS NULL 
                 AND a.tm > to_timestamp(${lastupdate/1000})
             GROUP BY a.postid, a.authorid, c.username, a.tm ORDER BY tm DESC LIMIT ${messagesLimit}) 
        SELECT a.postid, a.authorid, a.username AS author, trunc(1000*extract(epoch from a.tm)) as tm,
               a.body, a.score, count(b.origreplyid) AS numreplies 
        FROM cte1 a 
        LEFT JOIN posts b ON a.postid=b.origreplyid 
        GROUP BY a.postid, a.authorid, author, a.tm, a.score, a.body
        ORDER BY tm DESC`;
        } 
        // feed for user who is not logged in
        else { 
            messageFeed = await db.sql`WITH cte1 as 
            (SELECT a.postid, a.authorid, c.username, a.tm, a.body, sum(score) AS score
             FROM posts a 
             LEFT JOIN votes b ON a.postid=b.postid 
             LEFT JOIN users c ON a.authorid=c.userid 
             WHERE a.origreplyid IS NULL 
                 AND a.tm > to_timestamp(${lastupdate/1000})
             GROUP BY a.postid, a.authorid, c.username, a.tm ORDER BY tm DESC LIMIT ${messagesLimit}) 
        SELECT a.postid, a.authorid, a.username AS author, trunc(1000*extract(epoch from a.tm)) as tm,
               a.body, a.score, count(b.origreplyid) AS numreplies 
        FROM cte1 a 
        LEFT JOIN posts b ON a.postid=b.origreplyid 
        GROUP BY a.postid, a.authorid, author, a.tm, a.score, a.body
        ORDER BY tm DESC`;
        }

        let feed = [];
        tm = Date.now();
        console.log("messageFeed.length= ", messageFeed.length);
        const f = async () => {
            for (m of messageFeed) {
                // leave blank - client will request if needed
                m.replies = [];
                feed.push(m); 
            }
        }
        await f();

        return res.status(200).json({"feed":feed, "lastupdate":tm});
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
        await db.sql`INSERT INTO votes (postid, voterid, score)
            VALUES(${postid}, ${req.userID}, ${score})`;
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
        await db.sql`DELETE FROM votes WHERE postid=${postid} 
            AND voterid=${req.userID}`;
        return res.status(200).json({postid});
    } catch(e) {
        console.log("/vote error ", e)
        return res.status(500).send("vote error: " + e);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
