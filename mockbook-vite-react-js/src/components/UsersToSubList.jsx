import React from 'react'
import { useState, useEffect } from 'react'
import { doRequest, handleRequestError, makeRequestObj } from '../js/requests'

import UserToSub from './UserToSub'

const UsersToSubList = ({ userInfo }) => {
  const [usersToSubList, setUsersToSubList] = useState([]);

  useEffect(() => {
    const id = setInterval(async () => {
        if(userInfo.userID != 0)
          await getToSubList(userInfo.authToken, setUsersToSubList);
    }, 60000);

    return () => clearInterval(id);
  }, []);

  // console.log("UsersToSubList: usersToSubList=", usersToSubList);
  return (
    <div className="container-fluid" id="nosubs">
      { usersToSubList.map((sub)=> (<UserToSub key={sub.userid} authToken={userInfo.authToken} sub={sub} /> )) }
    </div>
  )
}

export default UsersToSubList

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

