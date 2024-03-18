function makeRequestObj(method, body, authtoken) {
    let req = { method: method, 
                headers: { 'Content-Type': 'application/json', 
                           'Authorization' : authtoken } };
    if (method == 'POST') {
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
    return await doRequest('/feed', 'GET', null, 'json', token);
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
        console.log(`FAIL nosubs == nosub2`);
    return subs;
}

async function testPost(token, userID, feed) {
    const body= { msgbody : "foo" };
    const [{tm}, t1] = await doRequest('/posts', 'POST', body, 'json', token, 201);
    // tests get post
    const [{posts:posts1}, t2] = await doRequest(`/posts/0/${tm}`, 'GET', null, 'json', token);
    const postID1 = parseInt(posts1[0].postid);
    const [{posts:posts2}, t3] = await doRequest(`/posts/${userID}/${tm}`, 'GET', null, 'json', token);
    const postID2 = parseInt(posts2[0].postid);
    if(postID1!=postID2)
        console.log(`FAIL postID1 ${postID1} != postID2 ${postID2}`);
    // console.log(`feed= ${feed}`);
    const postID = parseInt(feed[0].postid);
    
    // test reply
    const body2 = { msgbody : "fooreply", origreplyid:postID, replyid:postID };
    const [{tm2}, t4] = await doRequest('/posts', 'POST', body2, 'json', token, 201);
}

async function testVote(token, feed) {
    const postid = parseInt(feed[0].postid);
    const postid2 = parseInt(feed[1].postid);
    // console.log(`postid=${postid} postid2=${postid2}`)
    await doRequest(`/vote/${postid}?score=1`, 'POST', null, 'json', token, 201);
    await doRequest(`/vote/${postid2}?score=-1`, 'POST', null, 'json', token, 201);
    await doRequest(`/vote/${postid}`, 'DELETE', null, 'json', token);
    await doRequest(`/vote/${postid2}`, 'DELETE', null, 'json', token);
}

async function getAllReplies(token, postID) {
    [r, rtxt] = await doRequest(`/replies/${postID}`, 'GET', null, 'json', token);
    //console.log(`testReplies: post ${postID} replies length='${r.posts.length}'`);
    let numposts=r.posts.length;
    //if(expectedreplies > 0)
    //    console.log(`testReplies: replies expected=${expectedreplies} actual=${actual}`);
    if(r.posts.length > 0) {
        for(let pst of r.posts) {
            const postID = parseInt(pst.postid);
            //console.log(`testReplies: post ${postID} numreplies='${pst.numreplies}'`);
            numposts += await getAllReplies(token, postID, pst.numreplies);
        }
    }
    return numposts;
}

async function testReplies(token, feed) {
    for(let pst of feed) {
        const postID = parseInt(pst.postid);
        const numreplies = parseInt(pst.numreplies);
        const totalreplies = await getAllReplies(token, postID, pst.numreplies);
        if(numreplies != totalreplies) {
            console.log(`*** FAIL testReplies: replies expected=${numreplies} actual=${totalreplies} postID=${postID}`);
        }
    }
}

async function test() {
    usernames = ["alphabravo", "whiskeytango", "foxtrotlima", "yankeezulu"];
    for(let u of usernames) {
        const {token, userID} = await testLogin(u);
        console.log(`username='${u}' userID=${userID}`);
        const subs = await testSubs(token);
        console.log(`testSubs done`);
        const feed = await testFeed(token);
        console.log(`testFeed done`);
        await testPost(token, userID, feed[0].feed);
        console.log(`testPost done`);
        await testVote(token, feed[0].feed);
        console.log(`testVote done`);
        // get the feed again, since we addded post
        const feed2 = await testFeed(token);
        console.log(`testFeed (2) done`);
        await testReplies(token, feed2[0].feed);
        console.log(`testReplies done`);
    }
}

test();