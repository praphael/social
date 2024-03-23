import { Route, 
  createBrowserRouter, 
  createRoutesFromElements, 
  RouterProvider } from 'react-router-dom';
import {useState } from 'react'

const myRouter = createBrowserRouter( 
  createRoutesFromElements( 
  <Route path='/' element={<MainLayout/>}>
    <Route index element={<FeedPage/>} />
    <Route path="/login" element={<LoginPage/>} />
    <Route path="/register" element={<RegisterPage/>} />
  </Route>
  )
);
console.log("myRouter= ", myRouter);
// import './App.css'
import LoginPage from "./pages/LoginPage";
import FeedPage from './pages/FeedPage';
import RegisterPage from './pages/RegisterPage';
import MainLayout from './layouts/MainLayout';
import Login from './components/Login';
// import Registration from "./components/Registration"
// import Feed from "./components/Feed"

const App = () => {
  return <RouterProvider router={myRouter} />;
};

export default App
