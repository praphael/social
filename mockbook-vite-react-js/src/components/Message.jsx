import React from 'react'
import { doRequest, handleRequestError } from '../js/requests'

import Vote from './Vote';
import Reply from './Reply';


const Message = ({authToken, m, depth=0}) => {
  return (
    <div id={`"post${m.postid}"`} className="mb-3 mt-3 row container ms-${indent*2}">
        <div className="row">
            <span className="col"><h5>{m.author}</h5></span>
            <span className="col">{formatTimestamp(m.tm)}</span>
        </div>
        <div className="row">
            <div className="col-auto mb-3 mt-3">{m.body}</div>
        </div>
        <div className="row justify-content-between">
            <span className="col-4"><button type="button" className="btn btn-outline-info" data-bs-toggle="button"
            onClick={ ()=>(replyClick(m.postid)) }>Reply</button></span>
            <span className="col-2">Score: {m.score}</span>
            <span className="col-4"> 
                <Vote authToken={authToken} postID={m.postid}/>
            </span>
        </div>
        <Reply authToken={authToken} m={m.postid} origReplyID={m.origreplyid} />
        <div className="row mt-2">
            <span className="col-2">{m.numreplies} replies</span>
            <span className="col-2"><button className="btn btn-sm btn-outline-light" data-bs-toggle="button"
                onClick={ ()=>(showReplies(m.postid) )}>Show</button></span>
        </div>
        <div class="row" id={`"replies${m.postid}"`}>
            {m.replies.map((r)=>(<Message key={m.postid} authToken={authToken} m={r} depth={depth+1}/>))}
        </div>
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

function showReplies(authToken, postID) {

}