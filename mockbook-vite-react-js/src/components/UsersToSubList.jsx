import React from 'react'

import UserToSub from './UserToSub'

const UsersToSubList = ({ authToken, usersToSubList }) => {
  // console.log("UsersToSubList: usersToSubList=", usersToSubList);
  return (
    <div className="container-fluid" id="nosubs">
      { usersToSubList.map((sub)=> (<UserToSub key={sub.id} authToken={authToken} sub={sub} /> )) }
    </div>
  )
}

export default UsersToSubList

