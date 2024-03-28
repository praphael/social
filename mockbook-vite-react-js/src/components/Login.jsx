import React from 'react'
import { useNavigate } from 'react-router-dom'

import { doRequest, handleRequestError } from '../js/requests'

const Login = ({setUserInfo}) => {
  const navigate = useNavigate();

  return (
    <div id="loginform" className="container">
        <div className="col-lg-4"></div>
        <form className="container col-lg-4">
            <div className="row mb-3">
                <label className="form-label col-auto" htmlFor="loginusername">Username:</label>
                <input className="form-control input-md col-md-2" type="text" id="loginusername"/>
                <span className="col-lg-6"></span>
            </div>
            <div className="row mb-3">
                <label className="form-label col-auto" htmlFor="loginpassword">Password:</label>
                <input className="form-control input-md col-md-2" type="password" id="loginpassword"/>
                <span className="col-lg-6"></span>
            </div>  
            <div className="row mb-3">
                <button className="col-md-4 btn btn-primary" type="button" onClick={()=>(login(setUserInfo, navigate))}>Login</button>
                <span className="col-lg-6"></span>
            </div>
            <div className="row mt-3">
                <span className="col-sm-4 me-1 mb-1">New User?</span>
                <a className="col-sm-4" href="/register">Register</a>
            </div>
            <div id="loginresp" hidden></div>
        </form>
        <div className="col-lg-4"></div>
    </div>
  )
}

export default Login

async function login(setUserInfo, navigate) {
  const loginData = {
      username: document.getElementById("loginusername").value,
      password: document.getElementById("loginpassword").value
  };

  localStorage.clear();
  const j = await doRequest('/login', 'POST', loginData, "", (err) => {
      handleRequestError(err);
  });

  if (j != null) {
      console.log(`successful login token=${j.token}`);
      const userInfo = {userName:loginData.username, userId:j.userId, authToken:j.token}
      setUserInfo(userInfo);
      localStorage.setItem("userInfo", JSON.stringify(userInfo));
      // navigate to main feed
      navigate("/");
  }
}