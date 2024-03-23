import React from 'react'
import { useState, useEffect } from 'react'
import { useOutletContext } from "react-router-dom";

import { doRequest, handleRequestError, makeRequestObj } from '../js/requests'
import UsersToSubList from '../components/UsersToSubList'
import Feed from '../components/Feed'
import PostMsg from '../components/PostMsg';

const FeedPage = () => {
  const [userInfo, setUserInfo] = useOutletContext();

  const [lastUpdate, setLastUpdate] = useState(0);
  const [messageMap, setMessageMap] = useState(new Map());
  const [feed, setFeed] = useState([]);
  const [usersToSubList, setUsersToSubList] = useState([]);

  useEffect(() => {
    /*
    const getAndSetFeed = async () => {
        await getFeed(userInfo.authToken, lastUpdate, setLastUpdate, messageMap, setMessageMap); 
        setFeed(generateFeed(messageMap));
    };

    getAndSetFeed();
    */

    const id = setInterval(async () => {
        await getFeed(userInfo.authToken, lastUpdate, setLastUpdate, messageMap, setMessageMap); 
        setFeed(generateFeed(messageMap))}, 
        5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
        await getToSubList(userInfo.authToken, setUsersToSubList); 
    }, 5000);
        
    return () => clearInterval(id); 
    // getSubs();
  }, []);

  console.log("FeedPage: render");
  return (
    <div id="feedDiv" className="container"> 
        <div class="row mb-3">
            <PostMsg authToken={userInfo.authToken} />
            { /* logout button */ }
            <div className="col-2"><button className="btn btn-secondary" onClick={()=>(logout(setUserInfo))}>Logout</button></div>
        </div>
        <div className="row">
            <div className="col-2 me-2">
                <UsersToSubList authToken={userInfo.authToken} usersToSubList={usersToSubList} />
            </div>
            <div className="col-9">
                <Feed authToken={userInfo.authToken} feed={feed}/>
            </div>
        </div>
    </div>
  )
}

export default FeedPage

function logout(setUserInfo) {
    setUserInfo({userName:"", userID:0, authToken:""});
}

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
        m.showReplies = false;
    } catch(e) { console.log("fixMessage err=", e); }
}

function mergeReplies(oldMsg, newMsg) {
    if (oldMsg.replies.length < newMsg.replies.length) 
        oldMsg.replies = newMsg.replies;
}

function updateMessage(oldMsg, newMsg) {
    console.log("updateMessage oldMsg=", oldMsg, "newMsg=", newMsg);
    if (newMsg.hasOwnProperty("body") && oldMsg.body != newMsg.body) {
        m.needsRender = true;
        oldMsg.body = newMsg.body;
    }
    if (oldMsg.score != newMsg.score) {
        m.needsRender = true;
        oldMsg.score = newMsg.score;
    }
    if (oldMsg.numreplies != newMsg.numreplies) {
        m.needsRender = true;
        oldMsg.numreplies = newMsg.numreplies;
    }
    mergeReplies(oldMsg, newMsg);
}

function mergeFeed(messages, messageMap, setMessageMap) {
    // console.log(`mergeFeed messages=${JSON.stringify(messages)}`);
    for(let m of messages) {
        fixMessage(m);
        // console.log("mergeFeed m=", m);
        const key = m.postid;
        if (messageMap.has(key)) {
            mOld = messageMap.get(key);
            // console.log("mergeFeed mOld=", mOld);
            updateMessage(mOld, m);
        } else {
            messageMap.set(key, m);
        }
    }
    setMessageMap(messageMap);
}

async function getFeed(authToken, lastUpdate, setLastUpdate, messageMap, setMessageMap) {
    console.log(`getFeed lastupdate=${lastUpdate} authToken=${authToken}`);

    const rt = `/feed?lastupdate=${lastUpdate}`;
    const j = await doRequest(rt, 'GET', null, authToken, (err) => { 
        handleRequestError(err);
    });

    //console.log("getFeed: j=", j);

    if (j != null) {
        mergeFeed(j.feed, messageMap, setMessageMap);
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

async function getToSubList(authToken, setUserToSubList) {
    console.log("getToSubList authToken=", authToken);
  
    const j = await doRequest('/subs?mode=notsubs', 'GET', null, authToken, (err) => { 
        handleRequestError(err);
    });

    // console.log("getToSubList j=", j);
    if (j != null) {
      setUserToSubList(j.users);
    };
  }