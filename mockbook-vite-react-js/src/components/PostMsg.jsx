import React from 'react'

import { doRequest, handleRequestError }  from '../js/requests'

const PostMsg = (authToken) => {
  return (
    <form id="post" className="col-10">
      <div className="container-fluid">
        <div className="row">
            <div className="col-auto">
              <label className="form-label" for="text">Say something:</label>
            </div>
            <div className="col-8">
              <input className="form-control" type="text" id="newPostText"/>
            </div>
            <div className="col-auto">
              <button className="col-auto btn btn-primary" onClick={ ()=>postNew(authToken) } type="button">Post</button>
            </div>
        </div>
      </div>
    </form>
  )
}

export default PostMsg

async function postNew(authToken) {
  const msgbody = document.getElementById("newPostText").value;
  const rt = `/post`;
  const j = await doRequest(rt, 'POST', {msgbody:msgbody}, authToken, (err) => {
      handleRequestError(err);
  });

  if (j != null) {
      console.log("postNew server response", j);
      msg = { author:appState.username, tm:j.tm, body:text, numreplies:0};
      mergeFeed([msg]);
      await renderFeed();
  }
}