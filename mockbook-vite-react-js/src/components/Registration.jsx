import React from 'react'

import { doRequest, handleRequestError } from '../js/requests'

async function register() {

}

const Registration = () => {
  return (
    <div id="regform" className="container">
        <div className="col-md-4"></div>
        <form className="col-md-4 container">
            <div className="row mb-3">
                <label className="form-label" htmlFor="regusername">Desired Username:</label>
                <input className="form-control" type="text" id="regusername" name="regusername"/>
            </div>
            <div className="row mb-3">
                <label className="form-label" htmlFor="regemail">Email address:</label>
                <input className="form-control" type="text" id="regemail" name="regemail"/>
            </div>
            <div className="row mb-3">
                <label className="form-label" htmlFor="regpassword">Desired Password:</label>
                <input className="form-control" type="password" id="regpassword" name="regpassword"/>
            </div>
            <div className="row mb-3">
                <label className="form-label" htmlFor="regpassword2">Re-enter Password:</label>
                <input className="form-control" type="password" id="regpassword2" name="regpassword2"/>
            </div>
            <div className="row mt-3">
                <button className="col-md-4 btn btn-primary" type="button" onClick={register()}>Register</button>
                <span className="col-lg-4"></span>
            </div>
            <div className="row mt-3">
                <span className="col-sm-4 me-1 mb-1">Already registered?</span>
                <a className="col-sm-4" href="/login">Login</a>
            </div>
            <div id="regresp" hidden></div>
        </form>
        <div className="col-md-4"></div>
    </div>
  )
}

export default Registration