const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const dateFns = require('date-fns');

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI);

const Schema = mongoose.Schema;
const userSchema = new Schema({username : { type: String, required: true },count : {type: Number, required: true},log:[{description:String,duration:Number,date:Date}]});
const User = mongoose.model('User', userSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.route('/api/exercise/new-user').post((req, res) => {
  const usernameFromReq = req.body.username;
  const user = new User({username:usernameFromReq,count:0,log:[]});
  user.save().then(userData=>{
    console.log(userData);
    res.json({username:userData.username,_id:userData._id});
  });
});

app.get('/api/exercise/users',(req, res) => {
  User.find().then(users=>{
    res.json(users.map(userData=>({username:userData.username,_id:userData._id})));
  });
});

app.post('/api/exercise/add',(req, res) => {
  const {userId,description,duration,date}= req.body;
  if(!userId || !description || !duration) {
    const errArray = Object.keys(req.body).filter(val=>!req.body[val]).map(val=>`Path \`${val}\` is required.`);
    res.json({error:errArray});
  }
  const exerciseDate = date ? new Date(date).toDateString() : new Date().toDateString();
  User.findById(userId).then(userData=>{
    userData.log.push({description:description,duration:duration,date:exerciseDate});
    ++userData.count;
    User.update({_id:userId},{log:userData.log,count:userData.count}).then(userInfo=>{
      console.log(userInfo);
      res.json({username:userInfo.username,_id:userInfo._id,description:description,duration:duration,date:exerciseDate});
    });
  });
});

app.get('/api/exercise/log',(req, res) => {
  const {userId,from,to,limit} = req.query;
  console.log(userId);
  if(!userId) {
    res.json({error:['unknown userId']});
  }
  User.findById(userId).then(userData=>{
    const viewLog = userData.log.filter(data=>
      (from ? dateFns.isAfter(new Date(data.date),new Date(from)) : true) && (to ? dateFns.isBefore(new Date(data.date),new Date(to)) : true));
    const viewLogWithLimit = limit ? viewLog.slice(0,limit) : viewLog;
    const returnedObject = {_id:userData._id,username:userData.username,count:viewLogWithLimit.length,log:viewLogWithLimit.map(info=>({date:info.date.toDateString(),description:info.description,duration:info.duration}))};
    if(from) {
      returnedObject['from'] = new Date(from).toDateString();
    }
    if(to) {
      returnedObject['to'] = new Date(to).toDateString();
    }
    res.json(returnedObject);
  });
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
  .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
