import React from 'react'

import { doRequest, handleRequestError } from '../js/requests'

const UserToSub = ({ authToken, sub }) => {
  return (
    <div className="row mb-3 justify-content-between border-top border-right">
        <span className="col-1 border-left">{ sub.username }</span>
        <span className="col-1"><button className="btn btn-secondary" 
          onClick={()=>subscribe(authToken, sub)}>sub</button></span>
    </div>
  )
}

export default UserToSub

async function subscribe(authToken, sub) {
    console.log("subscribe sub=", sub.username);
}