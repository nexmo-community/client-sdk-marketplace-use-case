import React, { useState, useEffect } from 'react';
import './NexmoMarketplaceApp.css';
import NexmoClient from 'nexmo-client';

export default function NexmoMarketplaceApp() {
  const [stage, setStage] = useState('login'); //login, listings, conversation
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [items, setItems] = useState([]);
  const [nexmoApp, setNexmoApp] = useState('');
  const [nexmoConversation, setNexmoConversation] = useState('');
  const [conversationItem, setConversationItem] = useState({title:'',description:'',price:'',status:'Available'});
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);


  // useEffect(()=>{
  //   console.log('useEffect');
  //   if(nexmoConversation){
  //     nexmoConversation.on('text', (sender, event) => {
  //       console.log('text: sender, event: ', sender, event);
  //       setChatMessages(chatMessages => [...chatMessages, {sender: sender, message: event, me: nexmoConversation.me}]);
  //       // setChatMessages([...chatMessages,{sender:sender, message:event, me:conversation.me}]);
  //     });
  //
  //     return () => {
  //       nexmoConversation.off('text', (sender, event) => {
  //         console.log('remove text: sender, event: ', sender, event);
  //         setChatMessages(chatMessages => [...chatMessages, {sender: sender, message: event, me: nexmoConversation.me}]);
  //         // setChatMessages([...chatMessages,{sender:sender, message:event, me:conversation.me}]);
  //       });
  //     };
  //
  //   }
  //
  // });

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  const handleItemNameChange = (e) => {
    setItemName(e.target.value);
  };

  const handleItemDescriptionChange = (e) => {
    setItemDescription(e.target.value);
  };

  const handleItemPriceChange = (e) => {
    setItemPrice(e.target.value);
  };

  const submitUser = (e) => {
    fetch('https://green-crowberry.glitch.me/createUser', {
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
    })
    .then(results => results.json())
    .then(data => {
      setUserId(data.id);
      login();
    });
  };

  // Get JWT to authenticate user
  const getJWT = async () => {
    return await fetch('https://green-crowberry.glitch.me/getJWT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.split(' ').join('-')
      })
    })
    .then(results => results.json())
    .then(data => {
      console.log('getJWT data: ', data);
      return data.jwt;
    })
    .catch(err => console.log(err));
  };

  const login = async () => {
    const userJWT = await getJWT();
    console.log('userJWT: ', userJWT);
    getConversations();
    setStage('listings');
    new NexmoClient({ debug: false })
    .login(userJWT)
    .then(app => {
      setNexmoApp(app);
      return app.getConversations({ page_size: 20 })
    })
    .then(conversations_page => {
      // maybe in the future have a list/section of conversations the user is a member of
    })
    .catch(err => console.log(err));
  };

  // Get all conversations, even the ones the user isn't a member of, yet.
  const getConversations = () => {
    fetch('https://green-crowberry.glitch.me/getConversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 100
      })
    })
    .then(results => results.json())
    .then(data => {
      setItems(data.conversations);
    });
  };

  const submitItem = (e) => {
    console.log('submit item: ', e);
    createConversation();
  };

  const createConversation = () => {
    nexmoApp.newConversation({
      name: itemName.split(' ').join('-'), // comment out to get a GUID
      display_name: itemName.trim(),
      properties:{
        custom_data:{
          "title": itemName,
          "description": itemDescription,
          "price": itemPrice
        }
      }
    })
    .then((conversation) => {
      // join the created conversation
      conversation.join().then((member) => {
        conversation.sendCustomEvent({ type: 'custom:item_details', body: { title: itemName, description: itemDescription, price: itemPrice }})
        .then((custom_event) => {
          console.log(custom_event);
        });
      });
      getConversations();
      setItemName('');
      setItemDescription('');
      setItemPrice('');
    }).catch((error) => {
      console.log(error);
    });
  };

  const getConversation = async (item) => {
    console.log('getConversation: ',item);
    const conversation = await nexmoApp.getConversation(item.uuid);
    setNexmoConversation(conversation);
    if (!conversation.me){
      console.log('not a member. join!');
      const member = await conversation.join();
      console.log('getConversation member: ', member);
    }

    console.log('getConversation conversation: ', conversation);

    let allEvents = await conversation.getEvents({page_size: 100});
    console.log('allEvents: ',allEvents);
    allEvents.items.forEach(event => {
      switch(event.type){
        case 'text':
          setChatMessages(chatMessages => [...chatMessages,{sender:conversation.members.get(event.from), message:event, me:conversation.me}]);
          break;
        case 'custom:item_details':
          setConversationItem({...conversationItem,...event.body});
          break;
        case 'custom:stripe_payment':
          setChatMessages(chatMessages => [...chatMessages,{sender:{user:{name:'Stripe'}}, message:{body:{text:`${event.body.paymentDetails.description}: ${event.body.paymentDetails.status}`}}, me:''}]);
          if (event.body.paymentDetails.status === 'succeeded'){
            setConversationItem(prevState => {
              return { ...prevState, status: 'Sold' }
            });
          }
          break;
        default:
      }
    });

    conversation.on('text', (sender, event) => {
      console.log('text: sender, event: ', sender, event);
      setChatMessages(chatMessages => [...chatMessages, {sender: sender, message: event, me: conversation.me}]);
    });

    conversation.on('custom:stripe_payment', (sender, event) => {
      console.log('stripe payment: sender, event: ', sender, event);
      setChatMessages(chatMessages => [...chatMessages,{sender:{user:{name:'Stripe'}}, message:{body:{text:`${event.body.paymentDetails.description}: ${event.body.paymentDetails.status}`}}, me:''}]);
      if (event.body.paymentDetails.status === 'succeeded'){
        console.log('custom:stripe_payment: ', conversationItem);
        setConversationItem(prevState => {
          return { ...prevState, status: 'Sold' }
        });
      }
    });
    setStage('conversation');

  };


  const handleChatMessageChange = (e) => {
    setChatMessage(e.target.value);
  };

  const submitChatMessage = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    await nexmoConversation.sendText(chatMessage);
    console.log('submitChatMessage: ');
    setChatMessage('');
  };

  // Mock a Stripe Payment call. Reference: https://stripe.com/docs/api/charges/create
  const postStripePayment = () => {
    fetch('https://green-crowberry.glitch.me/stripePayment', {
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
    })
        .then(results => results.json())
        .then(data => {
          nexmoConversation.sendCustomEvent({ type: 'custom:stripe_payment', body: { paymentDetails: data.response }}).then((custom_event) => {
            console.log(custom_event);
          });
          // setItems(data.conversations);
        });
  };

  const removeEventListeners = () => {
    nexmoConversation.off('text', () => {
      console.log('remove text: sender, event');
    });


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
          <button onClick={()=> {removeEventListeners(); setNexmoConversation(null); setChatMessages([]); setConversationItem({title:'',description:'',price:'',status:'Available'});setStage('listings')}}>back to listings</button>
          <div id="conversationItemContainer">
            <div id="conversationItemDetailsContainer">
              <div id="conversationItemImage">image here</div>
              <div id="conversationItemDetails">
                <div>{conversationItem.title}</div>
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
                      <div className='sender'>{chatMessage.sender.display_name || chatMessage.sender.user.name || ''}</div>
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
