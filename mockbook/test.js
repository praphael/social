function makeRequestObj(method, body, authtoken) {
    let req = { method: method, 
                headers: { 'Content-Type': 'application/json', 
                           'Authorization' : authtoken } };
    if (method == 'POST' || method == 'PATCH' || method == 'PUT') {
        req.body = "";
        if (body != null && body != undefined)
            req.body = JSON.stringify(body);
    }
        
    return req;
}

const baseURL="http://localhost:3000"
async function doRequest(route, method, body, resType, token, statusExpected) {
    try {
        const response = await fetch(baseURL+route, makeRequestObj(method, body, token));
        const status = response.status;
        // console.log(`'${route}' ${method} status ${status}`);
        if (statusExpected === undefined || statusExpected === null)
            statusExpected = 200;
        if(status != statusExpected) {
            console.log(`'${route}' ${method} status ${status} expected ${statusExpected}`);
        }
        if (response.ok) {
            let r = null;
            if(resType === 'json') {
                r = await response.json();
                rtxt = JSON.stringify(r);
            } else {
                r = await response.text();
                rtxt = r;
            }
            // console.log(`'${route}' ${method} returned '${rtxt}'`);
            return [r, rtxt];
        } else {
            const errorMessage = await response.text();
            console.log(`ERROR ${errorMessage}`);
            return null;
        }
    } catch (error) {
        console.error(`'${route}' fetch error: ${error}`);
        return null;
    }
}

async function testLogin(username) {
    const userData = { username: username, password: username };
    const j = await doRequest('/login', 'POST', userData, 'json');
    if (j != null)
        return j[0];
    console.log("login failed, aborting test");    
    throw "failed";
}

async function testFeed(token) {
    const [r, s] = await doRequest('/feed', 'GET', null, 'json', token);
    const lu = r.lastupdate;
    console.log()
    const [r2, s2] = await doRequest(`/feed?lastupdate=${lu}`, 'GET', null, 'json', token);
    const [r3, s3] = await doRequest(`/feed?olderthan=${lu}`, 'GET', null, 'json', token);
    return r3.feed;
}

async function testSubs(token) {
    const subs = await doRequest('/subs?mode=subs', 'GET', null, 'json', token);
    const nosubs = await doRequest('/subs?mode=notsubs', 'GET', null, 'json', token);
    const subID = subs[0].users[0].userid;
    await doRequest(`/subs/${subID}`, 'DELETE', null, 'json', token);
    await doRequest(`/subs/${subID}`, 'POST', null, 'json', token, 201);
    const subs2 = await doRequest('/subs?mode=subs', 'GET', null, 'json', token);
    // const subseq = compArrays(subs.users, subs2.users);
    if(subs[1] != subs2[1])
        console.log(`FAIL subs == sub2`);
    const nosubID = nosubs[0].users[0].userid;
    await doRequest(`/subs/${nosubID}`, 'POST', null, 'json', token, 201);
    await doRequest(`/subs/${nosubID}`, 'DELETE', null, 'json', token);
    const nosubs2 = await doRequest('/subs?mode=notsubs', 'GET', null, 'json', token);
    // const nosubseq = compArrays(nosubs.users, nosubs2.users);
    if(nosubs[1] != nosubs2[1])
        console.log(`***** FAIL nosubs == nosub2`);
    return subs;
}

async function testPost(token) {
    const body= { msgbody : "foo" };
    const [{postid:postID1, tm:tm}, t1] = await doRequest('/posts', 'POST', body, 'json', token, 201);
    // tests get post
    const [{post:post1, lastupdate:u1}, t2] = await doRequest(`/posts/${postID1}`, 'GET', null, 'json', token);
    const postID1_g = parseInt(post1.postid);
    if(postID1 != postID1_g)
        console.log(`**** FAILED post id =${postID1} != returned ID=${postID1_g}`);
    if(post1.body != body.msgbody)
        console.log(`**** FAILED submitted body='${body.msgbody}' != returned body=${post1.body}`);
    
    // test reply
    const body2 = { msgbody : "fooreply", replyid_top_level:postID1, replyid:postID1 };
    const [{postid:postID2, tm2}, t4] = await doRequest('/posts', 'POST', body2, 'json', token, 201);
    const [{post:post2}, t5] = await doRequest(`/posts/${postID2}`, 'GET', null, 'json', token);
    const postID2_g = parseInt(post2.postid);
    if(postID2 != postID2_g)
        console.log(`**** FAILED (reply) post id =${postID1} != returned ID=${postID1_g}`);
    const [{post:post1_u}, t1_u] = await doRequest(`/posts/${postID1}`, 'GET', null, 'json', token);
    console.log(`${postID1} ${post1.numreplies} ${post1_u.numreplies}`);
    if(post1.numreplies + 1 != post1_u.numreplies)
        console.log(`**** FAILED (reply) reply count not increased expected ${post1.numreplies+1} got ${post1_u.numreplies}`);

    // test edit (PATCH)
    const body3 = { msgbody : "fooreply edit" };
    const [{postid:postID2_e, lastupdate:tm3}, t6] = await doRequest(`/posts/${postID2}`, 'PATCH', body3, 'json', token, 200);
    if(postID2_e != postID2)
        console.log(`**** FAILED (reply, edit) submitted postID=${postID2} != returned ${postID2_e}`);
    const [{post:post3}, t7] = await doRequest(`/posts/${postID2_e}`, 'GET', body3, 'json', token);
    if(post3.body != body3.msgbody)
        console.log(`**** FAILED (reply, edit) submitted body='${body3.msgbody}' != returned body=${post3.body}`);
}

async function testPostdelta(token, feed) {
    const postid = feed[3].postid;
    // console.log(`postid=${postid} postid2=${postid2}`)
    const [{post:post1, lastupdate:tm1}, t1] = await doRequest(`/posts/${postid}`, 'GET', null, 'json', token);
    console.log(`post1 score= ${post1.score} replies=${post1.numreplies} replies_top_level=${post1.numreplies_top_level}`);
    console.log(` body='${post1.body}'`);
    await doRequest(`/vote/${postid}?score=1`, 'POST', null, 'json', token, 201);
    const body2 = { msgbody : "fooreply", replyid_top_level:postid, replyid:postid };
    const [{postid:postID2, lastupdate:tm2}, t4] = await doRequest('/posts', 'POST', body2, 'json', token, 201);
    const [{msg:msg_u, lastupdate:tm3}, t5] = await doRequest(`/postdelta/${postid}?lastupdate=${tm1}`, 'GET', null, 'json', token);
    console.log("msg_u=", msg_u);

    const body3 = { msgbody : "foo" };
    const [{postid:postID2_e, lastupdate:tm4}, t6] = await doRequest(`/posts/${postid}`, 'PATCH', body3, 'json', token, 200);
    const [{msg:msg_u2, lastupdate:tm5}, t7] = await doRequest(`/postdelta/${postid}?lastupdate=${tm1}`, 'GET', null, 'json', token);
    console.log("msg_u2=", msg_u2);
}

async function testVote(token, feed) {
    const postid = parseInt(feed[4].postid);
    const postid2 = parseInt(feed[5].postid);
    // console.log(`postid=${postid} postid2=${postid2}`)
    const [{post:post1, lastupdate:tm1}, t1] = await doRequest(`/posts/${postid}`, 'GET', null, 'json', token);
    const [{post:post2, lastupdate:tm2}, t2] = await doRequest(`/posts/${postid2}`, 'GET', null, 'json', token);

    await doRequest(`/vote/${postid}?score=1`, 'POST', null, 'json', token, 201);
    await doRequest(`/vote/${postid2}?score=-1`, 'POST', null, 'json', token, 201);
    const [{post:post1_u, lastupdate:tm3}, t3] = await doRequest(`/posts/${postid}`, 'GET', null, 'json', token);
    const [{post:post2_d, lastupdate:tm4}, t4] = await doRequest(`/posts/${postid2}`, 'GET', null, 'json', token);
    await doRequest(`/vote/${postid}`, 'DELETE', null, 'json', token);
    await doRequest(`/vote/${postid2}`, 'DELETE', null, 'json', token);
    const [{post:post1_o, lastupdate:tm5}, t5] = await doRequest(`/posts/${postid}`, 'GET', null, 'json', token);
    const [{post:post2_o, lastupdate:tm6}, t6] = await doRequest(`/posts/${postid2}`, 'GET', null, 'json', token);
    console.log("post1.score=", post1.score);
    console.log("post1_u.score=", post1_u.score);
    if(post1_u.score != (post1.score + 1))
        console.log(`***** FAIL score not updated expected ${post1.score + 1} got ${post1_u.score}`);
    if(post2_d.score != (post2.score - 1))
        console.log(`***** FAIL score not updated expected ${post2.score - 1} got ${post2_d.score}`);
    if(post1.score != post1_o.score)
        console.log(`***** FAIL score not equal after DELETE expected ${post1.score} got ${post1_o.score}`);
    if(post2.score != post2_o.score)
        console.log(`***** FAIL score not equal after DELETE expected ${post2.score} got ${post2_o.score}`);
}

async function getReplies(token, postID, expectedreplies) {
    [r, rtxt] = await doRequest(`/replies/${postID}`, 'GET', null, 'json', token);
    //console.log(`testReplies: post ${postID} replies length='${r.posts.length}'`);
    let actual = r.replies.length;
    if(expectedreplies > 0 && expectedreplies != actual) {
        console.log(`**** FAIL getReplies: replies expected=${expectedreplies} actual=${actual}`);
    }
    let numreplies = actual;
    for(let pst of r.replies) {
        const postID = parseInt(pst.postid);
        //console.log(`testReplies: post ${postID} numreplies='${pst.numreplies}'`);
        numreplies += await getReplies(token, postID, pst.numreplies);
    }
    return numreplies;
}

async function testReplies(token, feed) {
    for(let pst of feed) {
        //console.log(pst);
        const postID = pst.postid;
        const replies_top_level = pst.numreplies_top_level;
        const totalreplies = await getReplies(token, postID, pst.numreplies);
        if(replies_top_level != totalreplies) {
            console.log(`***** FAIL testReplies: replies (top level) expected=${replies_top_level} actual=${totalreplies} postID=${postID}`);
        }
        const [allreplies, rtxt] = await doRequest(`/repliesall/${postID}`, 'GET', null, 'json', token);
    }
}

async function test() {
    usernames = ["alphacharlie", "echodelta", "limafoxtrot", "zuluquebec"];
    for(let u of usernames) {
        const {token, userID} = await testLogin(u);
        console.log(`username='${u}' userID=${userID}`);
        const subs = await testSubs(token);
        console.log(`testSubs done`);
        const feed = await testFeed(token);
        // console.log("feed= ", feed);
        console.log(`testFeed done`);
        await testPost(token, userID, feed);
        console.log(`testPost done`);
        await testVote(token, feed);
        console.log(`testVote done`);
        await testPostdelta(token, feed);
        console.log(`testPostdelta done`);
        // get the feed again, since we addded post
        const feed2 = await testFeed(token);
        console.log(`testFeed (2) done`);
        await testReplies(token, feed2);
        console.log(`testReplies done`);
    }
}

test();