
const db = require("./db");
const sha256 = require('js-sha256');

const loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
"Mauris pharetra, dui ornare maximus hendrerit, augue velit aliquam nisl, " +
"sit amet auctor elit massa in mauris. In ut tellus nibh. " +
"Cras pretium metus nec lacus fermentum tincidunt. ";

// bases for creating usernames
const userNameBase = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", 
"golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november",
"oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor",
"whiskey", "xray", "yankee", "zulu"];

const reInitialize = true;
const populate = true;
const numUsers = 26*26;
const votesPerPostRange = [0, 20];
const postsPerUserRange = [1, 30];
const subsPerUserRange = [1, 30];
// replies per post at different reply depths
const repliesPerPostRanges = [[0,6], [0,3], [0,2], [0,2]];
const startTime = Date.now()/1000;
let insertCnt = 0;
let failedInsertCnt = 0;
const rngSeed='foobar';
let rnd=rngSeed;
function getRandomInt(rng) {
    rnd = sha256(rnd);
    let x = parseInt('0x'+rnd.slice(30, 38)); 
    x = (x & ((1 << 31) - 1));
    r = rng[0] + x%(rng[1]-rng[0]);

    // r = rng[0] + Math.floor(Math.random() * rng[1]);
    // console.log(`getRandomInt rng=[${rng[0]} ${rng[1]}] r= ${r}`)
    return r;
}

// random time delta in milliseconds
function getRandomTimeDelta(minHours=1, maxHours=24) {
    hrs = getRandomInt([minHours, maxHours])
    mins = getRandomInt([0, 60]);
    secs = getRandomInt([0, 60]);
    return hrs*60*60 + mins*60 + secs;
}

const popDB = async ()=>{
    // indices in usernames
    ui = 0;
    uj = 0;
    uk = 0;
    let userNames = [];
    let userIDs = [];
    // generate usernames
    for (let i=0; i<numUsers; i++) {
        u = userNameBase[ui];
        u += userNameBase[uj];
        if(i>userNameBase.length**2)
            u += userNameBase[uk];
        userNames.push(u);
        ui += 1;
        if (ui >= userNameBase.length) {
            ui = 0;
            uj += 1;
        }
        if (uj >= userNameBase.length) {
            uk += 1;
            uj = 0;
        }
    }
    // console.log(userNames);

    // create users
    const createUsers = async () => {
        for(const u of userNames) {
            const pwd = u;
            const newuser = { username:u, passhash:sha256(pwd), email:u+"@foo.com", 
                regipaddr:'::1', isregistered:true };
            // console.log(`createUser u=${u}`)
            await db.sql`INSERT INTO users
                ${db.sql(newuser, 'username', 'passhash', 'email', 'regipaddr', 'isregistered')}`;
            // console.log(`createdUser u=${u}`)
            insertCnt++;
            const r2 = await db.sql`SELECT userid FROM users WHERE username=${u}`;
            userIDs.push(r2[0].userid);
        }
    };

    let subsArr = [];
    const createSubs = async () => {
        let ui = 0;
        for(const u of userNames) {
            numSubs = getRandomInt(subsPerUserRange);
            let subs = new Set();
            const userID = userIDs[ui];
            for(let j=0; j<numSubs; j++) {
                subi = ui;
                while(subi == ui || subs.has(subi)) {
                    subi = getRandomInt([0, numUsers]);
                }
                subs.add(subi);
                subID = userIDs[subi];
                // console.log(`subi=${subi} sub=${sub}`);
                // console.log(`  subi=${subi} sub=${sub}`);
                await db.sql`INSERT INTO usersubs (userid, subid)
                    values(${userID}, ${subID})`;
                insertCnt++;
            }
            console.log(`createdSubs u=${u} numSubs=${numSubs}`);
            subsArr.push(subs);
            ui += 1;
        }
        /*
        ui = 0;
        subsArr.forEach((a) => {
            subs = subsArr[ui];
            process.stdout.write(`subsArr[${ui}]= `);
            subs.forEach((s) => {
                process.stdout.write(" " + s);
            })
            console.log("");  
            ui++;          
        }); 
        */
    };

    const createVotes = async (ui, postID) => {
        // console.log(`createVotes i=${i} author=${author} tm=${tm} isReply=${isReply}`);
        const subs = subsArr[ui];
        
        // have subscribers vote on the post/reply
        const numVotes = Math.min(subs.size, getRandomInt(votesPerPostRange));
        subsiter = subs.values();
        for(let j=0; j<numVotes; j++) {
            subj = subsiter.next().value;
            // console.log(`createVotes j=${j} subj=${subj}`);
            const voterID = userIDs[subj];
            // generate +/-1 
            let score = 1;
            if(getRandomInt([0, 100]) < 25)
                score = -1;
            
            // console.log(`createVotes author=${author} tm=${tm} voter=${voter} score=${score}`);
            try {
                await db.sql`INSERT INTO votes (postid, voterid, score) 
                    values(${postID}, ${voterID}, ${score})`;
                insertCnt++;
            } catch(e) {
                console.log(`FAILED createVotes postID=${postID} voterID=${voterID} score=${score}`);
                failedInsertCnt++;
                // throw e;
                // console.log(e);
            }
            
            
        }
    }

    const createReplies = async (lvl, ui, origreplyID, replyID, replytm) => {
        // console.log(`createReplies lvl=${lvl} i=${i} origauthor=${origauthor} origtm=${origtm} replyauthor=${replyauthor} replytm=${replytm}`);
        const numReplies = getRandomInt(repliesPerPostRanges[lvl]);
        // do nothing since user has no subscribers
        if (subsArr[ui].length == 0)
            return;
        if (numReplies > 0) {
            for(let r=0; r<numReplies; r++) {
                // reply from random subscriber
                const subs = subsArr[ui];
                let si = getRandomInt([0, subs.size]);
                const subsiter = subs.values();
                while(si > 0) {
                    subsiter.next();
                    si--;
                }
                subi = subsiter.next().value;
                const authorID = userIDs[subi];
                if (authorID === undefined) {
                    console.log("author is undefined!");
                    continue;
                }
                const author = userNames[subi];
                
                // ensure the post is after previous, but not more recent 
                // than start time 
                let endHrs = (startTime-replytm)/3600;
                endHrs = Math.min(endHrs, 1);
                const tm = replytm + getRandomTimeDelta(0, endHrs);
                
                const body = author + " " + r + " " + tm + " " + loremIpsum;
                // create reply 
                // console.log(`createReplies r=${r} author=${author} tm=${tm} body=${body}`)
                let postID = null;
                try {
                    await db.sql`INSERT INTO posts (authorid, tm, origreplyID, 
                        replyid, body, ipaddr) 
                        values(${authorID}, to_timestamp(${tm}), ${origreplyID},
                        ${replyID}, ${body}, '::1')`;
                    insertCnt++;
                    const r = await db.sql`SELECT postid FROM posts WHERE authorID=${authorID} AND tm=to_timestamp(${tm})`;
                    postID = r[0].postid;
                } catch(e) {
                    console.log(`FAILED createReplies lvl=${lvl} r=${r} author=${author} tm=${tm} origpostID=${origpostID} replyID=${replyID} body=${body}`);
                    failedInsertCnt++;
                    // console.log(e);
                    // throw e;
                }
                if (postID === null || postID == undefined) {
                    console.log(`createReplies: authorID=${authorID} postID is null, continuing`);
                    continue;
                }

                // vote on reply    
                await createVotes(ui, postID);

                // create replies to reply (if depth not exceeded)
                if (lvl+1 < repliesPerPostRanges.length) {
                    await createReplies(lvl+1, ui, origreplyID, postID, tm);
                }
            }
        }
    }

    // create posts, replies and votes
    const createPostsRepliesVotes = async () => {
        let ui = 0;
        for (const authorID of userIDs) {
            const numPosts = getRandomInt(postsPerUserRange);
            const u = userNames[ui];
            for(let p=0; p<numPosts; p++) {
                const body = u + " " + p + " " + loremIpsum;
                const tm = startTime - getRandomTimeDelta(1, 24*30);
                let postID = null;
                // console.log(`createPostsRepliesVotes u=${u} ui=${ui} p=${p}`);
                try {
                    await db.sql`INSERT INTO posts (authorid, tm, body, ipaddr, origreplyid, replyid)
                        values(${authorID}, to_timestamp(${tm}), ${body}, '::1', NULL, NULL)`;
                    insertCnt++;
                    const r = await db.sql`SELECT postid FROM posts WHERE authorID=${authorID} AND tm=to_timestamp(${tm})`
                    postID = r[0].postid;
                } catch(e) {
                    console.log(`FAILED createPostsRepliesVotes u=${u} ui=${ui} p=${p}`);
                    // console.log(e);
                    failedInsertCnt++;
                    // throw e;
                }
                if(postID === null || postID == undefined) {
                    console.log(`createPostsRepliesVotes: authorID=${authorID} postID is null, continuing`);
                    continue;
                }
                // console.log(`createPostsRepliesVotes u=${u} ui=${ui} p=${p} SQL insert done`);
                await createVotes(ui, postID);
                // console.log(`createPostsRepliesVotes u=${u} ui=${ui} p=${p} createVotes done`);
                await createReplies(0, ui, postID, postID, tm);
                // console.log(`createPostsRepliesVotes u=${u} ui=${ui} p=${p} createReplies done`);
            }
            ui += 1;
            console.log(`createPostsRepliesVotes u=${u} done`);
        }
        console.log(`createPostsRepliesVotes done`);
    };

    await createUsers();
    console.log("add users done");
    await createSubs();
    console.log("add subs done");
    await createPostsRepliesVotes();
    console.log("add posts/replies/votes done");
};

const initDB = async (reInit, populate)=>{
    if (reInit) {
        await db.sql`DROP INDEX IF EXISTS votesindex CASCADE`;
        await db.sql`DROP INDEX IF EXISTS usersindex CASCADE`;
        await db.sql`DROP INDEX IF EXISTS postsindex CASCADE`;
        await db.sql`DROP INDEX IF EXISTS usersubsindex CASCADE`;
        await db.sql`DROP TABLE IF EXISTS votes CASCADE`;
        await db.sql`DROP TABLE IF EXISTS posts CASCADE`;
        await db.sql`DROP TABLE IF EXISTS usersubs CASCADE`;
        await db.sql`DROP TABLE IF EXISTS logins CASCADE`;
        await db.sql`DROP TABLE IF EXISTS users CASCADE`;
        await db.sql`DROP DOMAIN IF EXISTS username_t CASCADE`;
        await db.sql`DROP DOMAIN IF EXISTS email_t CASCADE`;
        await db.sql`DROP DOMAIN IF EXISTS auth2fa_t CASCADE`;
    }
    await db.sql`CREATE DOMAIN username_t AS varchar(32)`;
    await db.sql`CREATE DOMAIN email_t AS varchar(128)`;
    await db.sql`CREATE DOMAIN auth2fa_t AS varchar(128)`;
    await db.sql`CREATE TABLE IF NOT EXISTS users(
            username username_t,
            passhash varchar(64),
            email email_t,
            regipaddr inet,
            regtm timestamptz DEFAULT NOW(),
            auth2fa auth2fa_t DEFAULT NULL,
            isregistered boolean DEFAULT false,
            userid int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY)`;
    await db.sql`CREATE INDEX usersindex ON users USING HASH(username)`;
    await db.sql`CREATE TABLE IF NOT EXISTS logins(
            userid int REFERENCES users(userid),
            tm timestamptz DEFAULT NOW(),
            ipaddr inet NOT NULL,
            PRIMARY KEY(userid, tm))`;
    
    // NOTE: origreplyid is the postid of top-level/root post
    //   while replyid is postid of immediate parent
    //   origreplyid is useful for getting all replies for a given top-level post
    //   without recursive calls
    await db.sql`CREATE TABLE IF NOT EXISTS posts(
            authorid int REFERENCES users(userid),
            tm timestamptz NOT NULL,
            body text NOT NULL,
            ipaddr inet NOT NULL,
            origreplyid bigint,
            replyid bigint,
            postid bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY)`;
    await db.sql`CREATE INDEX postsindex ON posts (tm, authorid, origreplyid)`;
    await db.sql`CREATE TABLE IF NOT EXISTS usersubs(
            userid int REFERENCES users(userid),
            subid int REFERENCES users(userid))`;
    await db.sql`CREATE INDEX usersubsindex ON usersubs (userid, subid)`;
    // votes on original posts
    await db.sql`CREATE TABLE IF NOT EXISTS votes(
            postid bigint REFERENCES posts(postid),
            voterid int REFERENCES users(userid),
            score smallint CHECK(score=1 OR score=-1),
            PRIMARY KEY(postid, voterid))`;
    await db.sql`CREATE INDEX votesindex ON votes (postid, voterid)`;
    console.log("initDB() created all tables");
    if (populate) {
        console.log("initDB() populating DB..");
        await popDB();
    }
    console.log("initDB() done");
    dt = Date.now()/1000 - startTime;
    console.log(`timeElasped= ${dt} sec insertCnt= ${insertCnt} failedInsertCnt=${failedInsertCnt}`)
    console.log(`inserts/sec= ${insertCnt/dt}`)
    db.sql.end();
};

initDB(reInitialize, populate);


