const express = require('express')
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId
const cookieParser = require('cookie-parser')
const app = express();
let db;
const port = 3013

app.use(cookieParser())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.get('/', (req,res) => {
    res.send('can cats talk ?:)')
})

app.post('/users/sign', (req, res) => {
    db.collection('usersData').find().toArray((err, docs) => {

        const userData = {
            email: req.body.email,
            password: req.body.password,
            id: docs.length + 1
        }
    
        db.collection('usersData').insertOne(userData, (err, result) => {
            if (err) {
                console.log(err)
                return res.status(500)
            }
            res.send('success')
        })
    })
})

app.post('/users/auth', (req, res) => {

    db.collection('usersData').findOne({ email: req.body.email }, (err, doc) => {
        if (err) {
            console.log(err)
            return res.status(500)
        }
        else if (!doc) return res.status(403).json({msg: "User was not found"}) 

        else if (doc.password === req.body.password) {
            res.cookie('CatTalk_userId', doc.id)
            return res.status(200).json({msg: "Auth confirmed"})}   

        else if (doc.password !== req.body.password) return res.status(403).json({msg: "Password is incorrect"})
    })
})



const ValidateCookies = (req,res,next) => {
    if ('CatTalk_userId' in req.cookies) {
        next()
    }
    else {
        res.status(403).send({msg: "Not Authenticated"})
    }
}

app.get('/users/checkMyOwnInfo', ValidateCookies, (req, res) => {

    db.collection('usersData').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc) => {
        if (err) {
            console.log(err)
            return res.status(500)
        }
        res.send(doc)
    })
})


MongoClient.connect('mongodb+srv://pavlov:mspx@cattalk.g76jv.mongodb.net/myFirstDatabase?retryWrites=true&w=majority', (err, client) => {

    if (err) {
        return console.log(err)
    }

    db = client.db('CatTalk');

    app.listen(port, () => {
        console.log(`API is listening on port ${port}...`)
    })
})