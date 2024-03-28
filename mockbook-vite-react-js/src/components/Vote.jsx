import React from 'react'
import { useState } from 'react';

import { doRequest, handleRequestError } from '../js/requests'

const Vote = ({postID, userInfo}) => {
  const [score, setScore] = useState(0);

  return (
    <span className="container-fluid btn-group">
        <button type="button" id={`"vote${postID}up"`} className="btn btn-outline-success" 
            data-bs-toggle="button" onClick={(() => vote(userInfo, postID, score, 1, setScore)) }>^</button>
        <button type="button" id={`"vote${postID}down"`} className="btn btn-outline-danger" 
            data-bs-toggle="button" onClick={(() => vote(userInfo, postID, score, -1, setScore)) }>v</button>
    </span>
  )
}

export default Vote

async function vote(userInfo, postID, oldScore, newScore, setScore) {
    // delete old score first
    if(oldScore != 0) {
        await doRequest(`/vote/${postID}`, 'DELETE', null, userInfo.authToken, (err) => { 
            handleRequestError(err);
        });
    }

    // post new score if necessary
    if (newScore != 0) {
        await doRequest(`/vote/${postID}?score=${score}`, 'POST', null, userInfo.authToken, (errMsg) => { 
            handleRequestError(err);
        });
    }
    setScore(newScore);
}