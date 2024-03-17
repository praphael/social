const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path'); // Require the path module
const sha256 = require('js-sha256');
const Parameter = require('parameter');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret';
const db = require('./db.js');

app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the public directory

startTime = Date.now();

const paramValidator = new Parameter({
    /*
    translate: function() {
      var args = Array.prototype.slice.call(arguments);
      // Assume there have I18n.t method for convert language.
      return I18n.t.apply(I18n, args);
    }, */
    validateRoot: true, // restrict the being validate value must be a object
  });

function validateParamsOrFail(params, rule, endpt, res) {
    let errs = null;
    try {
        errs = paramValidator.validate(rule, params);
    } catch(e) {
        const msg = endpt + " exception during parameter validation: " + e;
        console.log(JSON.stringify(params));
        console.log(msg);
        res.status(500).send(msg);
        return false;
    }
    if(errs) {
        const msg = endpt + " parameter validation failed: " + JSON.stringify(errs)
        console.log(msg);
        console.log(JSON.stringify(params));
        res.status(400).send(msg);
        return false;
    }
    return true;
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        console.log(`verifyToken no token`);
        return res.status(401).send('Unauthorized: No token provided');
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log(`verifyToken invalid token ${token}`);
            return res.status(401).send('Unauthorized: Invalid token');
        }
        req.username = decoded.id;
        next();
    });
};

const loginRule = {
    username: 'string', 
    password: 'password'
}
// Route for user login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const ipaddr = req.ip;
    if (!validateParamsOrFail({ username, password }, loginRule, "login", res)) 
        return;
    
    try {
        // const user = users.find(user => user.username === username && user.password === password);
        const users = await db.sql`select passhash from users where username=${ username }`;
        console.log("login users= " + users);
        if (users.length > 0 && (sha256(password) == users[0].passhash)) {
            const token = jwt.sign({ id: username }, JWT_SECRET, { expiresIn: '1h' });
            try {
                const logininfo = { username:username, ipaddr:ipaddr };
                await db.sql`INSERT INTO logins
                    ${db.sql(logininfo, 'username', 'ipaddr')}`;
                console.log(`user ${username} logged in token= ${token}`);
                return res.status(200).json({ token });
            } catch(e) {
                const msg = "login failure: " + e;
                console.log(msg);
                return res.status(500).text(msg);
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

const registerRule = {
    username: 'string',
    password: 'password',
    password2: 'password',
    email: 'email',
    auth2fa : 'string'
}
// registration route
app.post('/register', async (req, res) => {
    console.log("register req.params= '" , req.params, "'")
    const { username, password, password2, email, auth2fa } = req.body;
    if (!validateParamsOrFail({ username, password, password2, email, auth2fa }, registerRule, "register", res))
        return;
    if(password != password2) {
        return res.status(400).send('Passwords do not match');
    }
    const ipaddr = req.ip;
    const newuser = { username:username, passhash:sha256(password),
                      email:email, ipaddr:ipaddr, auth2fa:auth2fa };
    try {
        await db.sql`INSERT INTO users
            ${db.sql(newuser, 'username', 'passhash', 'email', 'ipaddr', 'auth2fa')}`;
    } catch(e) {
        console.log("/register error ", e)
        return res.status(500).send('SQL insert error: ' + e);
    }
    return res.status(201).send("OK");
});

// Route to create a new message
app.post('/messages', verifyToken, async (req, res) => {
    console.log("messages req.body= '", req.body, "'");
    console.log("messages req.params= '", req.params, "'");
    const msgbody = req.body;
    const username = req.username;
    const ipaddr = req.ip;
    
    const tm = Date.now();
    console.log("messages tm=", tm);
    
    if (!validateParamsOrFail({msgbody:msgbody}, { msgbody : 'string'}, "messages POST", res))
        return;
    try {
        await db.sql`INSERT INTO posts (author, tm, body, ipaddr)
            VALUES(${username}, to_timestamp(${tm/1000}), ${msgbody}, ${ipaddr})`;
    } catch(e) {
        console.log("/messages error ", e);
        return res.status(500).send("messages error: " + e);
    }
    // return res.status(201).json(message);
    return res.status(201).json({tm: tm});
});

// Route to remove subscription 
app.delete('/subscribe/:sub',  verifyToken, async (req, res) => {
    console.log("DELETE /subscribe req.params", req.params)
    const username = req.username;
    const sub = req.params.sub;

    if(!validateParamsOrFail({ sub }, { sub : 'string'}, "subscribe DELETE", res))
        return;

    if (username === sub) {
        return res.status(400).send('Cannot unsubscribe from yourself');
    }
    try {
        await db.sql`DELETE FROM usersubs WHERE username=${username} AND sub=${sub}`
    } catch(e) {
        console.log("/subscribe (DELETE) error ", e)
        return res.status(500).send('SQL DELETE error: ' + e);
    }
    
    return res.status(200).send(sub);
});

// Route to subscribe to another user
app.post('/subscribe/:sub',  verifyToken, async (req, res) => {
    console.log("/subscribe req.params", req.params)
    const username = req.username;
    const sub = req.params.sub;

    if (username === sub) {
        return res.status(400).send('Cannot subscribe to yourself');
    }
    const usersub = { username:username, sub:sub };
    if(!validateParamsOrFail(usersub, { sub : 'string'}, "subscribe POST", res))
        return;
    
    try {
        await db.sql`INSERT INTO usersubs 
            ${db.sql(usersub, 'username', 'sub')}`;
    } catch(e) {
        console.log("/subscribe error ", e)
        return res.status(500).send('SQL INSERT error: ' + e);
    }
    
    return res.status(200).json(usersub);
});


// Route to get user's feed
app.get('/feed', verifyToken, async (req, res) => {
    console.log("/feed req.query", req.query);
    
    const nDays = 60;
    const messagesLimit = 50;
    const returnHTML = false;
    // last update time
    let lastUpdate = Date.now() - 1000*60*60*24*nDays
    const feedRule = {
        lastupdate : { type:'int' }
    }
    
    if (req.query.hasOwnProperty("lastupdate")) {
        try {
            lastupdate = parseInt(req.query.lastupdate);
        } catch(e) { }
    }
    if(!validateParamsOrFail({ lastupdate:lastupdate }, feedRule, "feed GET", res))
        return;
    // const username = req.params.username;
    const username = req.username;
    console.log(`feed username='${username}' lastupdate=${lastupdate}`);
    
    try {
        const messageFeed = await db.sql`WITH cte AS (SELECT a.author, a.tm, sum(score) AS score, a.body FROM posts a 
          LEFT JOIN votesposts b ON a.author=b.author AND a.tm=b.tm 
          WHERE a.author IN (select sub FROM usersubs WHERE username=${username}) 
          AND a.tm > to_timestamp(${lastupdate/1000})
          GROUP BY a.author, a.tm, a.body ORDER BY a.tm LIMIT ${messagesLimit}) 
        SELECT a.author, trunc(1000*extract(epoch from a.tm)) as tm, a.body, a.score, count(*) AS numreplies 
        FROM cte a 
        LEFT JOIN replies b 
        ON a.author=b.replyauthor AND a.tm=b.replytm 
        GROUP BY a.author, a.tm, a.body, a.score
        ORDER BY a.tm`
        if (returnHTML) {
            var feed = "";
        } else {
            var feed = [];
        }
        tm = Date.now();
        console.log("messageFeed.length= ", messageFeed.length);
        const f = async () => {
            for (m of messageFeed) {
                // console.log(m);
                /*
                replies = await db.sql`SELECT author, tm, body 
                FROM replies WHERE replyto=${ m.author } AND replytotm=to_timestamp(${ m.tm })
                ORDER BY tm DESC`;
                */
                replies = [];
                if (returnHTML) {
                    feed += renderMessage(m, replies); 
                } else {
                    m.replies = replies;
                    feed.push(m); 
                }
            }
        }
        await f();
    
        // console.log("feed=", feed);
        if(returnHTML) {
            res.set("HX-Trigger", `{"feedUpdated": ${tm} }`);
            return res.status(200).send(feed);
        }
        return res.status(200).json({"feed":feed, "lastupdate":tm});
    } catch(e) {
        console.log(e);
        return res.status(500).send('feed generation error: ' + e);
    }
});

// get list of users to which user is not subscribed
app.get('/users', verifyToken, async (req, res) => {
    const returnHTML = false;
    const userLimit = 30;
    console.log("/users");
    try {
        const users = await db.sql`SELECT username FROM users WHERE username!=${req.username}
        AND username NOT IN (SELECT sub FROM usersubs WHERE username=${req.username}) LIMIT ${userLimit}`;
        if (returnHTML) {
            userList = '<ul class="list-group">'
            users.forEach((u) => { 
                userList += `<li class="list-group-item container"><span class="col-auto me-3">${u.username}</span>`; 
                userList += `<button class="btn btn-secondary col-auto" hx-post="/subscribe/${u.username}" hx-headers='js:{"Authorization":appState.token}' hx-swap="innerHTML">sub</button>`
                userList += '</li>'
            });
            userList += "</ul>"
            return res.status(200).send(userList);
        } else {
            return res.status(200).json(users);
        }
    } catch(e) {
        console.log(e);
        return res.status(500).send('user list generation error: ' + e);
    }
});

const voteRule = {
    username: 'string',
    author: 'string',
    tm : 'int',
    isupvote: 'bool',
    isreply : 'bool'
}

app.post('/vote/:author/:tm', verifyToken, async (req, res) => {
    const vote = {username : req.username, 
               author : req.params.author,
               tm : req.params.tm,
               isupvote : req.query.isupvote, 
               isreply : req.query.isreply};
    if(!validateParamsOrFail(vote, voteRule, "vote", res))
        return;

    score = vote.isupvote? 1 : -1;
    try {
        if (vote.isreply == 'true') {
            await db.sql`INSERT INTO votesposts (author, tm, username, score)
                VALUES(${vote.author}, to_timestamp(${vote.tm/1000}), ${username}, ${score})`;
        } else {
            await db.sql`INSERT INTO votesreplies (author, tm, username, score)
                VALUES(${author}, to_timestamp(${tm/1000}), ${username}, ${score})`;
        }
    } catch(e) {
        console.log("/vote error ", e)
        return res.status(500).send("vote error: " + e);
    }
    
    return res.status(201).json(vote);
});

const replyRule = {
    author: 'string', 
    tm : 'int',
    origauthor : 'string',
    origtm : 'int',
    replyauthor : 'string',
    replytm : 'int',
    msgbody : 'string'
}
app.post('/reply', verifyToken, async (req, res) => {
    const msg = {author : req.username,
               tm : Date.now(),
               origauthor : req.body.origauthor,
               origtm : req.body.origtm,
               replyauthor : req.body.replyauthor,
               replytm : req.body.replytm,
               msgbody : req.body.msgbody };
    if(!validateParamsOrFail(msg, replyRule, 'reply', res))
        return;
    const ipaddr = req.ip;
    console.log("msg= ", msg);
    try {
        await db.sql`INSERT INTO replies (author, tm, body, origauthor, origtm, replyauthor, replytm, ipaddr)
            VALUES(${msg.author}, to_timestamp(${msg.tm/1000}), ${msg.msgbody}, ${msg.origauthor}, to_timestamp(${msg.origtm/1000}), 
            ${msg.replyauthor}, to_timestamp(${msg.replytm/1000}), ${ipaddr})`
    } catch(e) {
        console.log("/reply error ", e)
        return res.status(500).send('replyto error:' + e);
    }
    
    return res.status(201).json({"tm":msg.tm});
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
