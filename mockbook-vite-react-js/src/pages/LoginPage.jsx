import React from 'react'
import Login from '../components/Login'

import { useOutletContext } from "react-router-dom";

const LoginPage = () => {
  const [userInfo, setUserInfo] = useOutletContext();

  return (
    <Login setUserInfo={setUserInfo} />
  )
}

export default LoginPage