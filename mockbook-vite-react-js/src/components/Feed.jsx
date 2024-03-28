import Message from './Message'

import { useState, useEffect } from 'react'
import { doRequest, handleRequestError, makeRequestObj } from '../js/requests'

const Feed = ( {userInfo, setUserInfo} ) => {
    const [lastUpdate, setLastUpdate] = useState(0);
    const [messageMap, setMessageMap] = useState(new Map());
    const [feed, setFeed] = useState([]);
  
    useEffect(() => {
        const id = setInterval(async () => {
            await getFeed(userInfo, setUserInfo, lastUpdate, setLastUpdate,
                          messageMap, setMessageMap);
            setFeed(generateFeed(messageMap))},
            10000);
        return () => clearInterval(id);
      }, []);

    const updateMsg = (newMsg) => { 
        fixMessage(newMsg);
        console.log("updateMsg: newMsg=", newMsg);
        
        // post id should be unchanged
        const oldMsg = messageMap.get(newMsg.postid);
        messageMap.set(newMsg.postid, newMsg);
        
        console.log("updateMsg: oldMsg=", oldMsg);
        const idx = feed.indexOf(oldMsg);
        feed[idx] = newMsg;
    };
    console.log("Feed: feed.length=", feed.length);
    return (
        <div className="container-fluid" id="feed">
            { feed.map((m)=> (<Message key={m.postid} userInfo={userInfo} msg={m} updateMsg={updateMsg}/> )) }
        </div> 
    ) 
}

export default Feed

function fixMessage(m) {
    try {
        m.postid = parseInt(m.postid);
        m.tm = parseInt(m.tm);
        if(m.origreplyid != null)
            m.origreplyid = parseInt(m.origreplyid);
        if(m.replyid != null)
            m.replyid = parseInt(m.replyid);
        m.numreplies = parseInt(m.numreplies);
        m.score = parseInt(m.score);
        if(!m.hasOwnProperty("replies") || m.replies==null || m.replies==undefined)
            m.replies=[];
    } catch(e) { console.log("fixMessage err=", e); }
}

function mergeReplies(oldMsg, newMsg) {
    if (oldMsg.replies.length < newMsg.replies.length) 
        oldMsg.replies = newMsg.replies;
}

function updateMessage(oldMsg, newMsg) {
    // console.log("updateMessage oldMsg=", oldMsg, "newMsg=", newMsg);
    if (newMsg.hasOwnProperty("body") && oldMsg.body != newMsg.body) {
        oldMsg.body = newMsg.body;
    }
    if (oldMsg.score != newMsg.score) {
        oldMsg.score = newMsg.score;
    }
    if (oldMsg.numreplies != newMsg.numreplies) {
        oldMsg.numreplies = newMsg.numreplies;
    } 
    oldMsg.lastUpdate = newMsg.lastUpdate;
    
    mergeReplies(oldMsg, newMsg);
}

function mergeFeed(messages, messageMap, setMessageMap, lastUpdate) {
    // console.log(`mergeFeed messages=${JSON.stringify(messages)}`);
    for(let m of messages) {
        fixMessage(m);
        m.lastUpdate = lastUpdate;
        // console.log("mergeFeed m=", m);
        const key = m.postid;
        if (messageMap.has(key)) {
            let mOld = messageMap.get(key);
            // console.log("mergeFeed mOld=", mOld);
            updateMessage(mOld, m);
        } else {
            messageMap.set(key, m);
        }
    }
    setMessageMap(messageMap);
}

async function getFeed(userInfo, setUserInfo, lastUpdate, setLastUpdate, messageMap, setMessageMap) {
    console.log(`getFeed lastupdate=${lastUpdate} userInfo=`, userInfo);

    const rt = `/feed?lastupdate=${lastUpdate}`;
    const j = await doRequest(rt, 'GET', null, userInfo.authToken, (err) => { 
        userInfo.authToken = "";
        setUserInfo(userInfo);
        handleRequestError(err);
    });

    //console.log("getFeed: j=", j);

    if (j != null) {
        mergeFeed(j.feed, messageMap, setMessageMap, j.lastUpdate);
        // await renderFeed();
        setLastUpdate(j.lastupdate);
    }
}

function generateFeed(messageMap) {
    // console.log("generateFeed: messageMap= ", messageMap);
    let feed = [];
    let itr = messageMap.values();
    let v = itr.next().value;
    while (v != undefined) {
        feed.push(v)
        v = itr.next().value;
    }
    // console.log("generateFeed: feed= ", feed);
    feed.sort((a, b) => {
        if (a.tm == b.tm) return 0;
        else if (a.tm < b.tm) return -1;
        return 1;
    });
    return feed;
}
