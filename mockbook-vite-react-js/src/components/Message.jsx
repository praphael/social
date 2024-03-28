import React from 'react'
import { useState, useEffect } from 'react';
import { doRequest, handleRequestError, makeRequestObj } from '../js/requests'
import Vote from './Vote';
import ReplyTo from './ReplyTo';

const ReplyToOrBlank = ({isShowReplyTo, userInfo, postID, origReplyID}) => {
    if(isShowReplyTo)
        return (<ReplyTo userInfo={userInfo} postID={postID} origReplyID={origReplyID} />)
    return null;
}

const RepliesOrBlank = ({showReplies, userInfo, postID, replies, updateMsg, depth}) => {
    // console.log("RepliesOrBlank showReplies=", showReplies, " postID=", postID, "replies=", replies);
    if(showReplies)
        return (
            <div className="row" id={`"replies${postID}"`}>
                {replies != undefined? replies.map((r)=>(<Message key={r.postid} userInfo={userInfo} msg={r} updateMsg={updateMsg} depth={depth+1}/>)) : null }
            </div>)
    return null;
}
const Message = ({userInfo, msg, updateMsg, depth=0}) => {
  const [showReplyTo, setShowReplyTo] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  useEffect(() => {
    const id = setInterval(async () => {
        if(showReplies) {
            const j = await getUpdatedMsgAndReplies(userInfo, msg.postid, msg.lastUpdate);
            if(j != null && j != undefined) {
                // console.log("j=", j);
                let newMsg = j.post;
                newMsg.replies = j.replies;
                // console.log("newMsg.replies=", newMsg.replies);
                newMsg.lastUpdate = j.lastUpdate;
                updateMsg(newMsg);
            }
        }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const setShowRepliesMW = (isShowReplies) => {
    console.log(`setShowRepliesMW= ${isShowReplies}`);
    setShowReplies(!isShowReplies);
  }
  const indent=depth;
  if(showReplies)
        console.log(`Message ${msg.postid} showReplies=${showReplies}`)
  //console.log("Message depth=", depth, "msg.replies=", msg.replies);
  return (
    <div id={`"post${msg.postid}"`} className={`"mb-3 mt-3 row container ms-${indent*2}"`}>
        <div className="row">
            <span className="col"><h5>{msg.author}</h5></span>
            <span className="col">{formatTimestamp(msg.tm)}</span>
        </div>
        <div className="row">
            <div className="col-auto mb-3 mt-3">{msg.body}</div>
        </div>
        <div className="row justify-content-between">
            <span className="col-4"><button type="button" className="btn btn-outline-info" data-bs-toggle="button"
                aria-pressed={showReplyTo} onClick={ ()=>(setShowReplyTo(!showReplyTo)) }>Reply</button></span>
            <span className="col-2">Score: {msg.score}</span>
            <span className="col-4"> 
                <Vote userInfo={userInfo} postID={msg.postid}/>
            </span>
        </div>
        <ReplyToOrBlank isShowReplyTo={showReplyTo} userInfo={userInfo} postID={msg.postid} origReplyID={msg.origreplyid} />
        
        <div className="row mt-2">
            <span className="col-2">{msg.numreplies} replies</span>
            <span className="col-2"><button className="btn btn-sm btn-outline-light" data-bs-toggle="button"
                aria-pressed={showReplies} onClick={ ()=>(setShowRepliesMW(showReplies) )}>Show</button></span>
        </div>
        <RepliesOrBlank showReplies={showReplies} userInfo={userInfo} postID={msg.postid} replies={msg.replies} updateMsg={updateMsg} depth={depth} />
    </div>
  )
}

export default Message

function formatTimestamp(ts) {
    const diffTimeSec = (Date.now()-ts) / 1000;
    const diffMinutes = diffTimeSec / 60
    const diffHours = diffMinutes / 60
    const diffDays = diffHours / 24;
    const diffWeeks = diffDays / 7;    
    // console.log(`weeks days hours minutes seconds ${diffWeeks} ${diffDays} ${diffHours} ${diffMinutes} ${diffTimeSec}`);
    if (Math.floor(diffWeeks) > 0) {
        return `${Math.floor(diffWeeks)} weeks`
    } else if (Math.floor(diffDays) > 0) {
        return `${Math.floor(diffDays)} days`
    } else if (Math.floor(diffHours) > 0) {
        return `${Math.floor(diffHours)} hrs`
    } else if (Math.floor(diffMinutes) > 0) {
        return `${Math.round(diffMinutes)} min`
    } else {
        return `${Math.round(diffTimeSec)} sec`
    }
}

async function getUpdatedMsgAndReplies(userInfo, postID, lastUpdate) {
    //console.log(`getUpdatedMsgAndReplies lastupdate=${lastUpdate} userInfo=`, userInfo);

    const rt = `/posts/${postID}`;
    const j = await doRequest(rt, 'GET', null, userInfo.authToken, (err) => { 
        handleRequestError(err);
    });

    // console.log("getUpdatedMsgAndReplies: j=", j);

    return j;
}