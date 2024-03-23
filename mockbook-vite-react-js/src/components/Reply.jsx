import React from 'react'

import { doRequest, handleRequestError } from '../js/requests'

const Reply = ({authToken, postID, origReplyID}) => {
  return (
    <div id={`"reply${postID}"`} className="col">
        <div class="col-10">
            <form className="container-fluid">
                <div className="row">
                    <label className="col-1 form-label">Reply:</label>
                    <input className="ms-2 col-6 form-control" id={`"reply${postID}body"`}/>
                </div>
                <div className="row">
                    <button type="button" onclick={ ()=>(postReply(authToken, postID, origReplyID)) }
                         className="col-3 btn btn-sm btn-primary">Post</button>
                    <button type="button" className="col-3 btn btn-sm btn-secondary" 
                         onclick={ ()=>(cancelReply(postID)) }>Cancel</button>
                </div>
            </form>
        </div>
    </div>
  )
}

export default Reply

async function postReply(authToken, postID, origReplyID) {
    const replyToData = {
        replyid: postID,
        origreplyid: origReplyID,
        msgbody: document.getElementById(`reply${postID}body`).value
    };

    const j = await doRequest(`/posts`, 'POST', replyToData, authToken, (err) => {
        handleRequestError(err);
    });

    if (j != null) {
        deleteElement(`replyToSub${postID}`);
    } 
}