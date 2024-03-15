const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path'); // Require the path module
const sha256 = require('js-sha256');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret';

const db = require('./db.js');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the public directory

startTime = Date.now();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        console.log(`verifyToken no token`);
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log(`verifyToken invalid token ${token}`);
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        req.username = decoded.id;
        next();
    });
};

// Route for user login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(401).json({ message: 'Username/password missing from request' });
    }
    try {
        // const user = users.find(user => user.username === username && user.password === password);
        const users = await db.sql`select passhash from users where username=${ username }`;
        console.log("login users= " + users);
        if (users.length > 0 && (sha256(password) == users[0].passhash)) {
            const token = jwt.sign({ id: username }, JWT_SECRET, { expiresIn: '1h' });
            console.log(`token= ${token}`);
            return res.status(200).json({ token });
        } else {
            console.log("Invalid login from '" + username + "'");
            return res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch(e) {
        console.log("Error during login", e);
        return res.status(500).json({ message: 'login Server error' });
    }
});

app.post('/register', async (req, res) => {
    console.log("register req.params= '", req.params, "'")
    const username = req.params.newusername;
    const password = req.params.newuserpassword;
    console.log(`username ${username} password ${password}`);
    curTime = new Date(Date.now()).toISOString();
    const newuser = { username:username, passhash:sha256(password) };
    try {
        await db.sql`insert into users
            ${db.sql(newuser, 'username', 'passhash')}`;
    } catch(e) {
        console.log("/register error ", e)
        return res.status(500).json(e);
    }
    return res.status(201).send("ok");
});

// Route to create a new message
app.post('/messages', verifyToken, async (req, res) => {
    console.log("messages req.body= '", req.body, "'")
    console.log("messages req.params= '", req.params, "'")
    const text = req.body.text;
    const username = req.username;
    const returnHTML = false;

    if (!text) {
        return res.status(400).json({ message: 'Message text is required' });
    }
    
    tm = Date.now();
    console.log("messages tm=", tm);
    const message = { author:username, tm:tm, body:text };
    try {
        await db.sql`insert into posts (author, tm, body)
            values(${username}, to_timestamp(${tm}), ${text})`;
    } catch(e) {
        console.log("/messages error ", e);
        return res.status(500).json(e);
    }
    // return res.status(201).json(message);
    if(returnHTML) {
        msgHTML = renderMessage(message, []);
        return res.status(201).send(msgHTML);
    }
    return res.status(201).json(message);
});

// Route to remove subscription 
app.delete('/subscribe/:sub',  verifyToken, async (req, res) => {
    console.log("DELETE /subscribe req.params", req.params)
    const username = req.username;
    const sub = req.params.sub;

    if (!sub) {
        return res.status(400).json({ message: 'No subscription provided' });
    }
    if (username === sub) {
        return res.status(400).json({ message: 'Cannot unsubscribe to yourself' });
    }
    try {
        await db.sql`delete from user_subs where username=${username} and sub=${sub}`
    } catch(e) {
        console.log("/subscribe (DELETE) error ", e)
        return res.status(500).json(e);
    }
    
    return res.status(200).json({ message: 'Unsubscribed successfully' });
});

// Route to subscribe to another user
app.post('/subscribe/:sub',  verifyToken, async (req, res) => {
    console.log("/subscribe req.params", req.params)
    const username = req.username;
    const sub = req.params.sub;

    if (!sub) {
        return res.status(400).json({ message: 'No subscription provided' });
    }
    if (username === sub) {
        return res.status(400).json({ message: 'Cannot subscribe to yourself' });
    }
    const usersub = { username:username, sub:sub };
    try {
        await db.sql`insert into user_subs 
            ${db.sql(usersub, 'username', 'sub')}`;
    } catch(e) {
        console.log("/subscribe error ", e)
        return res.status(500).json(e);
    }
    
    return res.status(200).json({ message: 'Subscribed successfully' });
});

// Route to get user's feed
app.get('/feed', verifyToken, async (req, res) => {
    console.log("/feed req.params", req.params, " req.query", req.query);
    
    const nDays = 60;
    const messagesLimit = 20;
    const returnHTML = false;
    // last update time
    let lastupdate = Date.now() - 1000*60*60*24*nDays;
    if (req.query.hasOwnProperty("lastupdate")) {
        try {
            lastupdate = Number(req.query.lastupdate);
        } catch(e) { }
    }
    // const username = req.params.username;
    const username = req.username;
    console.log(`feed username='${username}' lastupdate=${lastupdate}`);

    try {
        const messages = await db.sql`SELECT author, trunc(1000*extract(epoch from tm)) as tm, body 
            FROM posts WHERE author in
            (SELECT sub FROM user_subs WHERE username=${ username }) AND tm > ${lastupdate}
            ORDER BY tm DESC LIMIT ${ messagesLimit }`;
        if (returnHTML) {
            var feed = "";
        } else {
            var feed = [];
        }
        tm = Date.now();
        
        const f = async () => {
            for (m in messages) {
                // console.log(m);
                replies = await db.sql`SELECT author, trunc(1000*extract(epoch from tm)) as tm, body 
                FROM replies WHERE replyto=${ m.author } AND replytotm=to_timestamp(${ m.tm })
                ORDER BY tm DESC`;
                if (returnHTML) {
                    feed += renderMessage(m, replies); 
                } else {
                    /*m.replies = [];
                    replies.forEach( (r) => {
                        m.replies.push(r);
                    });*/
                    m.replies = replies;
                    feed.push(m); 
                }
            }
        }
        await f();
    
        // console.log("feed=", feed);
        res.set("HX-Trigger", `{"feedUpdated": ${tm} }`);
        if(returnHTML) {
            return res.status(200).send(feed);
        }
        return res.status(200).json(feed);
    } catch(e) {
        console.log(e);
        return res.status(500).json(e);
    }
});

app.get('/users', verifyToken, async (req, res) => {
    const returnHTML = false;
    console.log("/users");
    try {
        const users = await db.sql`select username from users where username!=${req.username}
        and username not in (select sub from user_subs where username=${req.username})`;
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
        return res.status(500).json(e);
    }
});

app.post('/vote/:author/:tm/:updown', verifyToken, async (req, res) => {
    const username = req.username;
    const author = req.params.author;
    const tm = req.params.tm;
    const updown = req.params.updown;
    console.log(`${username} /vote/${author}/${tm}/${updown}`);

    if (!updown) {
        return res.status(400).json({ message: 'Up/down is required' });
    }
    
    if (updown == "up") {
        score = 1;
    } else if (updown == "down") {
        score = -1;
    } else {
        return res.status(400).json({ message: "Up/down needs to be only 'up' or 'down'"});
    }
    
    try { 
        tm = Number(req.params.tm);
    } catch(e) { 
        return res.status(400).json({ message: "Up/down needs to be only 'up' or 'down'"}); 
    }
    // const vote = { author:author, tm:tm, username:username, score:score };
    try {
        await db.sql`insert into votes (author, tm, username, score)
            values(${author}, to_timestamp(${tm}), ${username}, ${score})`;
    } catch(e) {
        console.log("/vote error ", e)
        return res.status(500).json(e);
    }
    
    return res.status(201).json(vote);
});

app.post('/replyto', verifyToken, async (req, res) => {
    const username = req.username;
    console.log('/replyto req.params= ', req.params, 'req.query= ', req.query, ' req.body= ', req.body);
    const replyto = req.body.replyto;
    const replytotm = req.body.replytotm;
    const text = req.body.replytobody;
    const returnHTML = false;

    if (!text) {
        return res.status(400).json({ message: "'replytobody' is required"});
    }
    if (!replyto || !replytotm) {
        return res.status(400).json({ message: "Invalid 'replyto' or 'replytotm'"});
    }
    
    let replytotmNum = 0;
    try {
        replytotmNum = Number(replytotm);
    } catch(e) {
        return res.status(400).json({ message: `Bad 'replytotm' ${replytotm} could not convert to integer`});
    }
    tm = Date.now()
    console.log(`tm=${tm}`);
    
    const message = { author:username, tm:tm, replyto:replyto, replytotm:replytotmNum, body:text };
    console.log("message= ", message);
    try {
        await db.sql`insert into replies (author, tm, replyto, replytotm, body)
            values(${username}, to_timestamp(${tm}), ${replyto}, to_timestamp(${replytotm}), ${text})`
    } catch(e) {
        console.log("/reply error ", e)
        return res.status(500).json(e);
    }
    
    if(returnHTML) {
        msgHTML = renderMessage(message, []);
        return res.status(201).send(msgHTML);
    } 
    return res.status(201).json(message);
});

app.get('/replyto', verifyToken, async (req, res) => {

});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
