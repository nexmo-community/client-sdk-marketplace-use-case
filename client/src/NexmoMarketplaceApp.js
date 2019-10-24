import React, { useState, useEffect } from 'react';
import './NexmoMarketplaceApp.css';
import NexmoClient from 'nexmo-client';

export default function NexmoMarketplaceApp() {
  const [stage, setStage] = useState('login'); //login, listings, conversation
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [items, setItems] = useState([]);
  const [nexmoApp, setNexmoApp] = useState('');
  const [nexmoConversation, setNexmoConversation] = useState('');
  const [conversationItem, setConversationItem] = useState({title:'',description:'',image_url:'',price:'',status:'Available',seller:''});
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(()=>{
    const addMessages = async (sender, event) => {
      let user = await nexmoApp.getUser(sender.user.id);
      setChatMessages(chatMessages => [...chatMessages, {avatar: user.image_url, sender: sender, message: event, me: nexmoConversation.me}]);
    };
    if(nexmoConversation){
      nexmoConversation.on('text', addMessages);
      return () => {
        nexmoConversation.off('text', addMessages);
      };
    }
  });

  useEffect(()=>{
    const setStripePayment = async (sender, event) => {
      setChatMessages(chatMessages => [...chatMessages,{sender:{user:{name:'Stripe'}}, message:{body:{text:`${event.body.paymentDetails.description}: ${event.body.paymentDetails.status}`}}, me:''}]);
      if (event.body.paymentDetails.status === 'succeeded'){
        setConversationItem(prevState => {
          return { ...prevState, status: 'Sold' }
        });
      }
    };
    if(nexmoConversation){
      nexmoConversation.on('custom:stripe_payment', setStripePayment);
      return () => {
        nexmoConversation.off('custom:stripe_payment', setStripePayment);
      };
    }
  });

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  const handleItemNameChange = (e) => {
    setItemName(e.target.value);
    setItemImage(`https://loremflickr.com/320/240/${e.target.value}`)
  };

  const handleItemImageChange = (e) => {
    setItemImage(e.target.value);
  };

  const handleItemDescriptionChange = (e) => {
    setItemDescription(e.target.value);
  };

  const handleItemPriceChange = (e) => {
    setItemPrice(e.target.value);
  };

  const submitUser = async (e) => {
    try{
      const results = await fetch('/createUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.split(' ').join('-'),
          display_name: name.trim(),
          image_url: `https://robohash.org/${name.split(' ').join('-')}`,
          properties: {
            custom_data: {
              "role": role
            }
          }
        })
      });
      await results.json();
      await login();
    } catch(err){
      console.log('submitUser error: ',err);
    }
  };

  // Get JWT to authenticate user
  const getJWT = async () => {
    try{
      const results = await fetch('/getJWT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.split(' ').join('-')
        })
      });
      const data = await results.json();
      return data.jwt;
    } catch(err){
      console.log('getJWT error: ',err);
    }
  };

  // Log in the user
  const login = async () => {
    try{
      const userJWT = await getJWT();
      const app =  await new NexmoClient({ debug: false }).login(userJWT);
      setNexmoApp(app);
      await getConversations();
      setStage('listings');
    } catch(err){
      console.log('login error: ',err);
    }
  };

  // Get all conversations, even the ones the user isn't a member of, yet.
  const getConversations = async() => {
    try{
        const results = await fetch('/getConversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            page_size: 100
          })
        });
        const data = await results.json();
        setItems(data.conversations);
    } catch(err) {
      console.log('getConversations error: ',err);
    }
  };

  const submitItem = async(e) => {
    await createConversation();
  };

  const createConversation = async() => {
    try{
      const conversation = await nexmoApp.newConversation({
        name: itemName.split(' ').join('-'), // comment out to get a GUID
        display_name: itemName.trim(),
        properties:{
          custom_data:{
            title: itemName,
            description: itemDescription,
            price: itemPrice,
            image_url: itemImage,
          }
        }
      });
      await conversation.join();
      await conversation.sendCustomEvent({ type: 'custom:item_details', body: { title: itemName, description: itemDescription, price: itemPrice, image_url: itemImage }})
      await getConversations();
      setItemName('');
      setItemImage('');
      setItemDescription('');
      setItemPrice('');
    } catch(err){
      console.log('createConversation error: ',err);
    }
  };

  const getConversation = async (item) => {
    try {
      const conversation = await nexmoApp.getConversation(item.uuid);
      setNexmoConversation(conversation);
      if (!conversation.me){
        await conversation.join();
      }

      let allEvents = await conversation.getEvents({page_size: 100});
      for(const [,event] of allEvents.items) {
        let user = await nexmoApp.getUser(conversation.members.get(event.from).user.id);
        switch(event.type){
          case 'text':
            setChatMessages(chatMessages => [...chatMessages,{avatar: user.image_url, sender:conversation.members.get(event.from), message:event, me:conversation.me}]);
            break;
          case 'custom:item_details':
            setConversationItem({...conversationItem,...event.body, seller: user});
            break;
          case 'custom:stripe_payment':
            setChatMessages(chatMessages => [...chatMessages,{avatar: '', sender:{user:{name:'Stripe'}}, message:{body:{text:`${event.body.paymentDetails.description}: ${event.body.paymentDetails.status}`}}, me:''}]);
            if (event.body.paymentDetails.status === 'succeeded'){
              setConversationItem(prevState => {
                return { ...prevState, status: 'Sold' }
              });
            }
            break;
          default:
        }
      }
      setStage('conversation');
    } catch(err){
      console.log('getConversation error: ',err);
    }
  };

  const handleChatMessageChange = (e) => {
    setChatMessage(e.target.value);
  };

  const submitChatMessage = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await nexmoConversation.sendText(chatMessage);
      setChatMessage('');
    } catch (err){
      console.log('submitChatMessage: error', err);
    }
  };

  // Mock a Stripe Payment call. Reference: https://stripe.com/docs/api/charges/create
  const postStripePayment = async() => {
    try{
      const results = await fetch('/stripePayment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(conversationItem.price.replace('$','')) * 100,
          currency: "usd",
          source: "tok_amex", // obtained with Stripe.js
          description: `Charge for ${conversationItem.title} from ${name}.`
        })
      });
      const data = await results.json();
      await nexmoConversation.sendCustomEvent({ type: 'custom:stripe_payment', body: { paymentDetails: data.response }});
    } catch(err){
      console.log('createConversation error: ',err);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>
          Nexmo Marketplace App
        </h1>
      </header>
      {stage === 'login' && (
        <div id='login'>
          <label htmlFor="name">Name:</label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={handleNameChange}
          />
          <br/>
          <label htmlFor="role">I am a:</label>
          <select name="role" id="role" onChange={handleRoleChange}>
            <option value="">--Please choose an option--</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
          <br/>
          <button onClick={(e) => submitUser(e)} disabled={name.trim() === '' || role === ''}>submit</button>
        </div>
      )}


      {stage === 'listings' && (
        <div>
          {role.toLowerCase() === 'seller' ? (
            <div>
              <p>Item for Sale</p>
              <label htmlFor="itemName">Title:</label>
              <input
                  id="itemName"
                  name="itemName"
                  value={itemName}
                  onChange={handleItemNameChange}
              />
              <br/>
              <label htmlFor="itemImage">Image URL:</label>
              <input
                  id="itemImage"
                  name="itemImage"
                  value={itemImage}
                  onChange={handleItemImageChange}
              />
              <br/>
              <label htmlFor="itemDescription">Description:</label>
              <textarea
                  id="itemDescription"
                  name="itemDescription"
                  value={itemDescription}
                  onChange={handleItemDescriptionChange}
              />
              <br/>
              <label htmlFor="itemPrice">Price:</label>
              <input
                  id="itemPrice"
                  name="itemPrice"
                  value={itemPrice}
                  onChange={handleItemPriceChange}
              />
              <br/>
              <button onClick={(e) => submitItem(e)} disabled={itemName.trim() === '' || itemDescription.trim() === '' || itemPrice.trim() === ''}>submit</button>
            </div>
          ) : ''}
          <p>Items for sale</p>
          <ul>
            {items.map((item, index) =>{
              return <li key={index} onClick={() => getConversation(item)}>{item.name}</li>
            })}
          </ul>
        </div>
      )}

      {stage === 'conversation' && (
        <div>
          <button onClick={()=> {setNexmoConversation(null); setChatMessages([]); setConversationItem({title:'',description:'',image_url:'',price:'',status:'Available',seller:''});setStage('listings')}}>back to listings</button>
          <div id="conversationItemContainer">
            <div id="conversationItemDetailsContainer">
              <div id="conversationItemImage"><img src={conversationItem.image_url} alt="Item for sale"/></div>
              <div id="conversationItemDetails">
                <div>{conversationItem.title} <br/>seller: {conversationItem.seller['display_name']}</div>
                <div>{conversationItem.description}</div>
              </div>
              <div id="conversationItemPrice">{conversationItem.price}</div>
            </div>
            <div id="conversationItemDetailsOptions">
              <button id="payNow" onClick={() => postStripePayment()} disabled={conversationItem.status!=='Available'}>Pay Now</button>
              <div id="itemStatus">Status: {conversationItem.status}</div>
            </div>
          </div>
          <div id="chatContainer">
            <div id="messagesContainer">
              {chatMessages.map((chatMessage, index) =>{
                return (
                    <div key={index} className={chatMessage.message.from === chatMessage.me.id ? 'myChatMessageContainer' : 'chatMessageContainer'}>
                      <div className='sender'>{(chatMessage.avatar !== '' && chatMessage.avatar) && <img src={chatMessage.avatar} className="avatar" alt="User profile avatar"/> }<br/>{chatMessage.sender.display_name || chatMessage.sender.user.name || ''}</div>
                      <div className='message'>{chatMessage.message.body.text}</div>
                    </div>
                )
              })}
            </div>
            <div id="chatInput">
              <textarea id="messageTextarea" name="messageTextarea" rows="5" cols="30" placeholder="Start Typing..." value={chatMessage} onChange={handleChatMessageChange}/>
              <br/>
              <button onClick={(e) => submitChatMessage(e)}>Send Message</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
