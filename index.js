const express = require('express')
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId
const cookieParser = require('cookie-parser')
const app = express();
let db;
const port = process.env.PORT || 3013

app.use(cookieParser())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var cors = require('cors');
app.use(cors({
    credentials: true,
    // origin: 'https://cat-talk2.vercel.app',
    origin: 'http://localhost:3000',
    allowedHeaders: 'Authorization, Origin, X-Requested-With, content-type, Accept',
    "optionsSuccessStatus": 200
}));



app.get('/', (req, res) => {
    res.send(' can cats talk ?:)')
})

app.post('/users/sign', (req, res) => {
    db.collection('usersData').findOne({ email: req.body.email }, (err, doc) => {
        if (doc) {
            return res.status(409).json({ msg: "This email has already been used" })
        }

    })

    db.collection('usersData').find().toArray((err, docs) => {

        const userData = {
            email: req.body.email,
            password: req.body.password,
            id: docs.length + 1
        }

        db.collection('usersData').insertOne(userData, (err, result) => {

            if (err) return res.status(500)

        })
    })

    db.collection('users').find().toArray((err, docs) => {

        const user = {
            id: docs.length + 1,
            email: req.body.email,
            login: req.body.username,
            info: {
                name: req.body.name,
                surname: req.body.surname,
                username: req.body.username,
                email: req.body.email,
                id: docs.length + 1,
                age: null,
                location: null,
                avatar: null,
                instagramLink: null
            },
            stats: {
                totalChats: 0,
                totalMessagesSent: 0,
                totalCharactersEntered: 0,
            },
            friends: []

        }

        db.collection('users').insertOne(user, (err, result) => {

            if (err) return res.status(500)

            return res.status(200).json({ msg: "Auth confirmed" })
        })
    })
})

app.post('/users/auth', (req, res) => {

    db.collection('usersData').findOne({ email: req.body.email }, (err, doc) => {

        if (err) return res.status(500)

        else if (!doc) return res.status(404).json({ msg: "User was not found" })

        else if (doc.password === req.body.password) {
            res.cookie('CatTalk_userId', doc.id, {
                secure: true,
                sameSite: 'None'
            })
            db.collection('users').findOne({ email: req.body.email }, (err, doc2) => {
                if (doc) {
                    return res.status(200).json(doc2)
                }

            })
        }
        else if (doc.password !== req.body.password) return res.status(403).json({ msg: "Incorrect values" })
    })
})



const ValidateCookies = (req, res, next) => {
    if ('CatTalk_userId' in req.cookies) {
        next()
    }
    else {
        res.status(403).send({ msg: "Not Authenticated" })
    }
}

app.get('/users/checkMyOwnInfo', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc) => {

        if (err) return res.status(500)

        res.send(doc)
    })
})


app.put('/users/updateMyOwnInfo', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc1) => {

        if (err) return res.status(500)

        db.collection('users').findOne({ login: req.body.username }, (err, loginDoc) => {


            if (loginDoc) {
                if (doc1.id !== loginDoc.id) {
                    return res.status(409).send({ msg: "Username is already exist" })
                }
            }

            db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                {
                    $set: {
                        info: {
                            name: req.body.name,
                            surname: req.body.surname,
                            username: req.body.username,
                            email: doc1.info.email,
                            id: doc1.info.id,
                            age: req.body.age,
                            location: req.body.location,
                            avatar: doc1.info.avatar,
                            instagramLink: doc1.info.instagramLink
                        }
                    }
                }, (err, doc2) => {

                    if (err) return res.status(500)

                    db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                        { $set: { login: req.body.username } }, (err, doc2) => {

                            if (err) return res.status(500)

                        })

                    res.send({ msg: 'Success' })
                })
        })

    })




})

app.delete('/users/logout', ValidateCookies, (req, res) => {
    res.cookie('CatTalk_userId', '0', { secure: true, sameSite: 'None', maxAge: 0 });
    return res.status(200).json({ msg: 'Success' })
})

app.get('/users/:id', (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.params.id) }, (err, doc) => {

        if (err) return res.status(500)
        if (!doc) return res.status(404).json({ msg: 'User was not found' })
        res.send(doc)

    })
})


app.post('/token/add', (req, res) => {

    const tokenData = {
        token: req.body.token,
        isBusy: false,
        connectedUsers: 0
    }

    db.collection('tokens').insertOne(tokenData, (err, result) => {

        if (err) return res.status(500)

        res.status(200).json({ msg: "Success" })

    })

})

app.get('/token/get', (req, res) => {

    db.collection('tokens').find({ isBusy: false }).toArray((err, docs) => {
        if (err) return res.status(500)
        const num = Math.floor(Math.random() * docs.length)
        res.send(docs[parseInt(num)])
    })
})

app.post('/token/find', (req, res) => {

    db.collection('tokens').findOne({ _id: ObjectId(req.body.token) }, (err, doc) => {

        if (err) return res.status(500)
        if (!doc) return res.status(404).json({ msg: 'Token was not found' })
        res.status(200).json({ found_token: doc.token })

    })
})

app.post('/chat/join', (req, res) => {

    db.collection('tokens').findOne({ token: req.body.token }, (err, doc1) => {

        if (err) return res.status(500)
        if (!doc1) return res.status(404).json({ msg: 'Token was not found' })

        db.collection('tokens').updateOne({ token: req.body.token },
            { $set: { isBusy: true, connectedUsers: parseInt(doc1.connectedUsers + 1) } }, (err, doc2) => {

                if (err) return res.status(500)

                res.status(200).send({ msg: 'Success' })

                db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc3) => {

                    if (err) return res.status(500)
                    console.log(doc3.totalMessagesSent)
                    db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                        {
                            $set: {
                                stats: {
                                    totalChats: parseInt(doc3.totalChats + 1),
                                    totalMessagesSent: parseInt(doc3.totalMessagesSent),
                                    totalCharactersEntered: parseInt(doc3.totalCharactersEntered) 
                                }
                            }
                        }, (err, doc4) => {

                            if (err) return res.status(500)

                            res.status(200).send({ msg: 'Success' })

                        })

                })

            })

    })

})

app.post('/chat/leave', (req, res) => {

    db.collection('tokens').findOne({ token: req.body.token }, (err, doc1) => {

        if (err) return res.status(500)
        if (!doc1) return res.status(404).json({ msg: 'Token was not found' })

        db.collection('tokens').updateOne({ token: req.body.token },
            { $set: { isBusy: doc1.connectedUsers - 1 !== 0 ? true : false, connectedUsers: parseInt(doc1.connectedUsers - 1) } }, (err, doc2) => {

                if (err) return res.status(500)

                res.status(200).send({ msg: 'Success' })
            })

    })

})

MongoClient.connect('mongodb+srv://pavlov:mspx@cattalk.g76jv.mongodb.net/myFirstDatabase?retryWrites=true&w=majority', (err, client) => {

    if (err) {
        return
    }

    db = client.db('CatTalk');

    app.listen(port, () => {
        console.log(`API is listening on port ${port}...`)
    })
})