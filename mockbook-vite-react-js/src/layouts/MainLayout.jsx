import React from 'react'
import { useState } from 'react'
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';


  
const MainLayout = () => {
  const [userInfo, setUserInfo] = useState({ userName: "", userID: 0, authToken: ""});
  /* const uInfStr = localStorage.getItem("userInfo");
  if(uInfStr != null && uInfStr != undefined) {
    try { setUserInfo(JSON.parse(uInfStr)); }
    catch(e) { console.log("MainLayout: failed to parse user info")}
  } */
  
  return (
    <> 
        <Navbar />
        <Outlet context={[userInfo, setUserInfo]} />
    </>
  )
}

export default MainLayout