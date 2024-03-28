import React from 'react'

import { doRequest, handleRequestError } from '../js/requests'

const ReplyTo = ({userInfo, postID, origReplyID, setShowReplyTo}) => {
  return (
    <div id={`"reply${postID}"`} className="col">
        <div className="col-10">
            <form className="container-fluid">
                <div className="row">
                    <label className="col-1 form-label">Reply:</label>
                    <input className="ms-2 col-6 form-control" id={`"reply${postID}body"`}/>
                </div>
                <div className="row">
                    <button type="button" onclick={ ()=>(postReply(userInfo, postID, origReplyID, setShowReplyTo)) }
                         className="col-3 btn btn-sm btn-primary">Post</button>
                    <button type="button" className="col-3 btn btn-sm btn-secondary" 
                         onClick={ ()=>(cancelReply(postID, setShowReplyTo)) }>Cancel</button>
                </div>
            </form>
        </div>
    </div>
  )
}

export default ReplyTo

async function postReply(userInfo, postID, origReplyID) {
    const replyToData = {
        replyid: postID,
        origreplyid: origReplyID,
        msgbody: document.getElementById(`reply${postID}body`).value
    };

    const j = await doRequest(`/posts`, 'POST', replyToData, userInfo.authToken, (err) => {
        handleRequestError(err);
    });

    if (j != null) {
       setShowReplyTo(false);
    } 
}

function cancelReply(postIDm, setShowReplyTo) {
    setShowReplyTo(false);
}