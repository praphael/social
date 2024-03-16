
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
const numUsers = 26*26*5;
const votesPerPostRange = [0, 20];
const postsPerUserRange = [0, 50];
const subsPerUserRange = [1, 300];
// replies per post at different reply depths
const repliesPerPostRanges = [[0,6], [0,3], [0,2], [0,2]];
const startTime = Date.now()/1000;
let insertCnt = 0;
let failedInsertCnt = 0;
function getRandomInt(rng) {
    r = rng[0] + Math.floor(Math.random() * rng[1]);
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
    // generate usernames
    for (let i=0; i<numUsers; i++) {
        u = userNameBase[ui];
        if (uj > 0) {
            u += userNameBase[uj];
        }
        if (uk > 0) {
            u += userNameBase[uk];
        }
        userNames.push(u);
        ui += 1;
        if (ui >= userNameBase.length) {
            ui = 0;
            uj += 1;
        }
        if (uj >= userNameBase.length) {
            uk += 1;
            uj = 1;
        }
    }
    // console.log(userNames);

    // create users
    const createUsers = async () => {
        for(const u of userNames) {
            const newuser = { username:u, passhash:sha256(u), isregistered:true };
            // console.log(`createUser u=${u}`)
            const r = await db.sql`insert into users
                ${db.sql(newuser, 'username', 'passhash', 'isregistered')}`;
            // console.log(`createdUser u=${u}`)
            insertCnt++;
        }
    };

    let subsArr = [];
    const createSubs = async () => {
        let ui = 0;
        for(const u of userNames) {
            numSubs = getRandomInt(subsPerUserRange);
            let subs = new Set();
            for(let j=0; j<numSubs; j++) {
                subi = ui;
                while(subi == ui || subs.has(subi)) {
                    subi = getRandomInt([0, numUsers]);
                }
                subs.add(subi);
                sub = userNames[subi];
                // console.log(`subi=${subi} sub=${sub}`);
                // console.log(`  subi=${subi} sub=${sub}`);
                await db.sql`insert into usersubs (username, sub)
                    values(${u}, ${sub})`;
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

    const createVotes = async (i, author, tm, isReply) => {
        // console.log(`createVotes i=${i} author=${author} tm=${tm} isReply=${isReply}`);
        const subs = subsArr[i];
        
        // have subscribers vote on the post/reply
        const numVotes = Math.min(subs.size, getRandomInt(votesPerPostRange));
        subsiter = subs.values();
        for(let j=0; j<numVotes; j++) {
            subj = subsiter.next().value;
            // console.log(`createVotes j=${j} subj=${subj}`);
            const voter = userNames[subj];
            // generate +/-1 
            const score = 1 - 2*getRandomInt([0, 2]);
            
            // console.log(`createVotes author=${author} tm=${tm} voter=${voter} score=${score}`);
            try {
                if(isReply) {
                    await db.sql`insert into votesreplies (author, tm, voter, score) 
                        values(${author}, to_timestamp(${tm}), ${voter}, ${score})`

                } else {
                    await db.sql`insert into votesposts (author, tm, voter, score) 
                        values(${author}, to_timestamp(${tm}), ${voter}, ${score})`

                }
                insertCnt++;
            } catch(e) {
                console.log(`FAILED createVotes author=${author} tm=${tm} voter=${voter} score=${score}`);
                failedInsertCnt++;
                // throw e;
                // console.log(e);
            }
            
            
        }
    }

    const createReplies = async (lvl, i, origauthor, origtm, replyauthor, replytm) => {
        // console.log(`createReplies lvl=${lvl} i=${i} origauthor=${origauthor} origtm=${origtm} replyauthor=${replyauthor} replytm=${replytm}`);
        const numReplies = getRandomInt(repliesPerPostRanges[lvl]);
        // do nothing since user has no subscribers
        if (subsArr[i].length == 0)
            return;
        if (numReplies > 0) {
            for(let r=0; r<numReplies; r++) {
                // reply from random subscriber
                const subs = subsArr[i];
                let si = getRandomInt([0, subs.size]);
                const si_init = si;
                const subsiter = subs.values();
                while(si > 0) {
                    subsiter.next();
                    si--;
                }
                const author = userNames[subsiter.next().value];
                if (author === undefined) {
                    console.log("author is undefined!");
                    continue;
                }
                else if (author == "alpha") {
                    console.log(`author is 'alpha' si_init=${si_init}`);
                }
                
                // ensure the post is after previous, but not more recent 
                // than start time 
                let endHrs = (startTime-replytm)/3600;
                endHrs = Math.min(endHrs, 1);
                const tm = replytm + getRandomTimeDelta(0, endHrs);
                
                const body = author + " " + r + " " + tm + " " + loremIpsum;
                // create reply 
                // console.log(`createReplies r=${r} author=${author} tm=${tm} body=${body}`)
                try {
                    await db.sql`insert into replies (author, tm, origauthor, origtm, 
                        replyauthor, replytm, body) 
                        values(${author}, to_timestamp(${tm}), ${origauthor}, to_timestamp(${origtm}), 
                        ${replyauthor}, to_timestamp(${replytm}), ${body})`;
                    insertCnt++;
                } catch(e) {
                    console.log(`FAILED createReplies lvl=${lvl} r=${r} author=${author} tm=${tm} origauthor=${origauthor} replyauthor=${replyauthor} body=${body}`);
                    failedInsertCnt++;
                    // throw e;
                    // console.log(e);
                }

                // vote on reply    
                await createVotes(i, author, tm, true);

                // create replies to reply (if depth not exceeded)
                if (lvl+1 < repliesPerPostRanges.length) {
                    await createReplies(lvl+1, i, origauthor, origtm, author, tm);
                }
            }
        }
    }

    // create posts, replies and votes
    const createPostsRepliesVotes = async () => {
        let ui = 0;
        for (const u of userNames) {
            const numPosts = getRandomInt(postsPerUserRange);
            for(let p=0; p<numPosts; p++) {
                const body = u + " " + p + " " + loremIpsum;
                const tm = startTime - getRandomTimeDelta(1, 24*30);
                // console.log(`createPostsRepliesVotes u=${u} ui=${ui} p=${p}`);
                try {
                    await db.sql`insert into posts (author, tm, body)
                        values(${u}, to_timestamp(${tm}), ${body})`;
                    insertCnt++;
                } catch(e) {
                    console.log(`FAILED createPostsRepliesVotes u=${u} ui=${ui} p=${p}`);
                    failedInsertCnt++;
                    // throw e;
                    // console.log(e);
                }
                
                // console.log(`createPostsRepliesVotes u=${u} ui=${ui} p=${p} SQL insert done`);
                await createVotes(ui, u, tm, false);
                // console.log(`createPostsRepliesVotes u=${u} ui=${ui} p=${p} createVotes done`);
                await createReplies(0, ui, u, tm, u, tm);
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
        await db.sql`DROP TABLE IF EXISTS votesposts`;
        await db.sql`DROP TABLE IF EXISTS votesreplies`;
        await db.sql`DROP TABLE IF EXISTS replies`;
        await db.sql`DROP TABLE IF EXISTS posts`;
        await db.sql`DROP TABLE IF EXISTS usersubs`;
        await db.sql`DROP TABLE IF EXISTS users`;        
    }
    await db.sql`CREATE TABLE IF NOT EXISTS users(username varchar(32) PRIMARY KEY, passhash varchar(64),
            isRegistered boolean)`;
    await db.sql`CREATE TABLE IF NOT EXISTS posts(author varchar(32) REFERENCES users(username), 
            tm timestamptz NOT NULL, 
            body text NOT NULL, 
            PRIMARY KEY(author, tm))`;
    // NOTE: replyauthor and replytm should internally reference replies(author, tm),
    // or be the same as origauthor, origtm
    await db.sql`CREATE TABLE IF NOT EXISTS replies(author varchar(32), 
            tm timestamptz, body text NOT NULL,
            origauthor varchar(32), origtm timestamptz,
            replyauthor varchar(32), replytm timestamptz, 
            PRIMARY KEY(author, tm), 
            FOREIGN KEY(origauthor, origtm) REFERENCES posts(author, tm))`;
    await db.sql`CREATE TABLE IF NOT EXISTS usersubs(username varchar(32) REFERENCES users(username), 
            sub varchar(32) REFERENCES users(username))`;
    // votes on original posts
    await db.sql`CREATE TABLE IF NOT EXISTS votesposts(author varchar(32), tm timestamptz, 
            voter varchar(32) REFERENCES users(username), score smallint,
            PRIMARY KEY(author, tm, voter),
            FOREIGN KEY(author, tm) REFERENCES posts(author,tm))`;
    // votes on replies
    await db.sql`CREATE TABLE IF NOT EXISTS votesreplies(author varchar(32), tm timestamptz, 
            voter varchar(32) REFERENCES users(username),
            PRIMARY KEY(author, tm, voter), score smallint,
            FOREIGN KEY(author, tm) REFERENCES replies(author,tm))`;
    
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


