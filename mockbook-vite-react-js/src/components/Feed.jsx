import Message from './Message'

const Feed = ({authToken, feed}) => {
  // console.log("Feed: feed=", feed);
  return (
    <div className="container-fluid" id="feed">
        { feed.map((m)=> (<Message key={m.postid} authToken={authToken} m={m} /> )) }
    </div> 
  )
}

export default Feed
