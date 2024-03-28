import React from 'react'
import { useOutletContext } from "react-router-dom";

import UsersToSubList from '../components/UsersToSubList'
import Feed from '../components/Feed'
import PostMsg from '../components/PostMsg';

const PostMsgOrLoginMsg = ({authToken, setUserInfo}) => {
    console.log("PostMsgOrLoginMsg: authToken=", authToken)
    if (authToken == "" || authToken == null || authToken == undefined) 
        return (<div>You are not logged in. 
            <a href="/login">Login</a>
        </div> )
    else
        return (<PostMsg authToken={authToken}>
            <div className="col-2"><button className="btn btn-secondary" onClick={()=>(logout(setUserInfo))}>Logout</button></div>
            </PostMsg>)    
}
const FeedPage = () => {
  const [userInfo, setUserInfo] = useOutletContext();

  console.log("FeedPage: render");
  return (
    <div id="feedPage" className="container">
        <div className="row mb-3">
            <PostMsgOrLoginMsg authToken={userInfo.authToken} setUserInfo={setUserInfo} />
        </div>
        <div className="row">
            <div className="col-2 me-2">
                <UsersToSubList userInfo={userInfo} />
            </div>
            <div className="col-9">
                <Feed userInfo={userInfo} setUserInfo={setUserInfo} />
            </div>
        </div>
    </div>
  )
}

export default FeedPage

function logout(setUserInfo) {
    setUserInfo({userName:"", userID:0, authToken:""});
}
