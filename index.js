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

let cors = require('cors');

app.use(cors({
    credentials: true,
    // origin: 'http://localhost:3000',
    // origin: 'https://cat-talk2.vercel.app',
    // origin: 'https://cat-talk-l6mh5d0xf-pavlovvv.vercel.app',
    origin: 'https://cat-talk2-pavlovvv.vercel.app',
    allowedHeaders: 'Authorization, Origin, X-Requested-With, Access-Control-Request-Headers, content-type, Content-Type, Access-Control-Request-Method, Accept, Access-Control-Allow-Headers',
    "optionsSuccessStatus": 200
}));


// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "http://localhost:3000");
//     res.header("Access-Control-Allow-Credentials", true);
//     res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
//     res.header("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Authorization, Origin, Accept, content-type, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
//     next()
// })


app.get('/', (req, res) => {
    res.send(' can cats talk ?:)')
})

app.post('/auth/signup', (req, res) => {
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



app.post('/auth/login', (req, res) => {

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
        res.status(403).json({ msg: "Not Authenticated" })
    }
}

app.get('/auth/checkMyOwnInfo', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc) => {

        if (err) return res.status(500)

        res.status(200).send(doc)
    })
})


app.put('/auth/updateMyOwnInfo', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc1) => {

        if (err) return res.status(500)

        db.collection('users').findOne({ login: req.body.username }, (err, loginDoc) => {


            if (loginDoc) {
                if (doc1.id !== loginDoc.id) {
                    return res.status(409).json({ msg: "Username is already exist" })
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

                    res.status(200).json({ msg: 'Success' })
                })
        })

    })




})

app.delete('/auth/logout', ValidateCookies, (req, res) => {
    res.cookie('CatTalk_userId', '0', { secure: true, sameSite: 'None', maxAge: 0 });
    return res.status(200).json({ msg: 'Success' })
})

app.get('/users/search/:id', (req, res) => {

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

app.post('/token/getConnectedUsers', (req, res) => {

    db.collection('tokens').findOne({ token: req.body.token }, (err, doc) => {

        if (err) return res.status(500)
        if (!doc) return res.status(404).json({ msg: 'Token was not found' })
        res.status(200).json({ connectedUsers: doc.connectedUsers })

    })
})

app.post('/chat/join', ValidateCookies, (req, res) => {

    db.collection('tokens').findOne({ token: req.body.token }, (err, doc1) => {

        if (err) return res.status(500)
        if (!doc1) return res.status(404).json({ msg: 'Token was not found' })

        db.collection('tokens').updateOne({ token: req.body.token },
            { $set: { isBusy: true, connectedUsers: parseInt(doc1.connectedUsers + 1) } }, (err, doc2) => {

                if (err) return res.status(500)

                db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc3) => {

                    if (err) return res.status(500)
                    db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                        {
                            $set: {
                                stats: {
                                    totalChats: parseInt(doc3.stats.totalChats + 1),
                                    totalMessagesSent: parseInt(doc3.stats.totalMessagesSent),
                                    totalCharactersEntered: parseInt(doc3.stats.totalCharactersEntered) 
                                }
                            }
                        }, (err, doc4) => {

                            if (err) return res.status(500)

                            return res.status(200).json({ msg: 'Success' })

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

                res.status(200).json({ msg: 'Success' })
            })

    })

})


app.post('/chat/sendMessage', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc3) => {

        if (err) return res.status(500)

        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    stats: {
                        totalChats: parseInt(doc3.stats.totalChats),
                        totalMessagesSent: parseInt(doc3.stats.totalMessagesSent + 1),
                        totalCharactersEntered: parseInt(doc3.stats.totalCharactersEntered) 
                    }
                }
            }, (err, doc4) => {

                if (err) return res.status(500)

                return res.status(200).json({ msg: 'Success' })

            })
    })
})


app.post('/chat/enterCharacter', ValidateCookies, (req, res) => {

                db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc3) => {

                    if (err) return res.status(500)

                    db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                        {
                            $set: {
                                stats: {
                                    totalChats: parseInt(doc3.stats.totalChats),
                                    totalMessagesSent: parseInt(doc3.stats.totalMessagesSent),
                                    totalCharactersEntered: parseInt(doc3.stats.totalCharactersEntered + 1) 
                                }
                            }
                        }, (err, doc4) => {

                            if (err) return res.status(500)

                            return res.status(200).json({ msg: 'Success' })

                        })
                })
            })


app.get('/users/mostChats', (req, res) => {

    db.collection('users').find().toArray((err, docs) => {
        if (err) return res.status(500)
        docs.sort((a, b) => parseInt(b.stats.totalChats) - parseInt(a.stats.totalChats));
        res.send(docs)
    })
})

app.get('/users/mostSentMessages', (req, res) => {

    db.collection('users').find().toArray((err, docs) => {
        if (err) return res.status(500)
        docs.sort((a, b) => parseInt(b.stats.totalMessagesSent) - parseInt(a.stats.totalMessagesSent));
        res.send(docs)
    })
})

app.get('/users/mostCharactersEntered', (req, res) => {

    db.collection('users').find().toArray((err, docs) => {
        if (err) return res.status(500)
        docs.sort((a, b) => parseInt(b.stats.totalCharactersEntered) - parseInt(a.stats.totalCharactersEntered));
        res.send(docs)
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