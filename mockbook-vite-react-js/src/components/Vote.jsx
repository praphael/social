import React from 'react'
import { useState } from 'react';

import { doRequest, handleRequestError } from '../js/requests'

const Vote = ({postID, authToken}) => {
  const [score, setScore] = useState(0);

  return (
    <span className="container-fluid btn-group">
        <button type="button" id={`"vote${postID}up"`} className="btn btn-outline-success" 
            data-bs-toggle="button" onclick={`"vote(${authToken}, ${postID}, ${score}, 1, ${setScore})"`}>^</button>
        <button type="button" id={`"vote${postID}down"`} className="btn btn-outline-danger" 
            data-bs-toggle="button" onclick={`"vote(${authToken}, ${postID}, ${score}, -1, ${setScore})"`}>v</button>
    </span>
  )
}

export default Vote

async function vote(authToken, postID, oldScore, newScore, setScore) {
    // delete old score first
    if(oldScore != 0) {
        await doRequest(`/vote/${postID}`, 'DELETE', null, authToken, (err) => { 
            handleRequestError(err);
        });
    }

    // remove 'active' from 
    otherVote.setAttribute("aria-pressed", false);
    otherVote.classList.remove("active");

    // post new score if necessary
    if (newScore != 0) {
        await doRequest(`/vote/${postID}?score=${score}`, 'POST', null, authToken, (errMsg) => { 
            alert(errMsg);
            console.log(errMsg);
        });
    }
    setScore(newScore);
}