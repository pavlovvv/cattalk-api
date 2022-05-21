const express = require('express')
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId
const cookieParser = require('cookie-parser')
let cors = require('cors');
const sizeOf = require('image-size');
const fs = require('fs')
const { uploadFile } = require('./s3.js')
const app = express();

const multer = require('multer')
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, new Date().toISOString().replace(/:/g, '-') + file.originalname)
    },
})

const fileFilter = (req, file, cb) => {

    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true)
    }

    else {
        cb(null, false)
    }

}

const upload = multer({
    storage: storage,
    limits: 1024 * 1024 * 20,
    fileFilter: fileFilter
})

let db;
const port = process.env.PORT || 3013

app.use(cookieParser())
app.use('/uploads', express.static('uploads'))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000',
    // origin: 'https://cat-talk2.vercel.app',
    // origin: 'https://cat-talk-l6mh5d0xf-pavlovvv.vercel.app',
    // origin: 'https://cat-talk2-pavlovvv.vercel.app',
    allowedHeaders: 'Authorization, Origin, X-Requested-With, Access-Control-Request-Headers, content-type, Content-Type, Access-Control-Request-Method, Accept, Access-Control-Allow-Headers',
    "optionsSuccessStatus": 200
}));


app.get('/', (req, res) => {
    res.send(' can cats talk ?:)')
})

app.post('/auth/signup', (req, res) => {
    db.collection('usersData').findOne({ email: req.body.email }, (err, doc) => {
        if (doc) {
            return res.status(409).json({ msg: "This email has already been used" })
        }

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
                    instagramLink: null,
                    telegramUsername: null,
                    discordUsername: null
                },
                stats: {
                    totalChats: 0,
                    totalMessagesSent: 0,
                    totalCharactersEntered: 0,
                },
                friends: {
                    confirmedFriends: [],
                    pendingFriends: [],
                    totalFriendsCount: 0
                }

            }

            db.collection('users').insertOne(user, (err, result) => {

                if (err) return res.status(500)

                return res.status(200).json({ msg: "Auth confirmed" })
            })
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
        else if (doc.password !== req.body.password) return res.status(400).json({ msg: "Incorrect values" })
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
                    return res.status(409).json({ msg: "This username is already exist" })
                }
            }

            db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                {
                    $set: {
                        // info: {
                        //     name: req.body.name,
                        //     surname: req.body.surname,
                        //     username: req.body.username,
                        //     email: doc1.info.email,
                        //     id: doc1.info.id,
                        //     age: req.body.age,
                        //     location: req.body.location,
                        //     avatar: doc1.info.avatar,
                        //     instagramLink: doc1.info.instagramLink,
                        //     telegramUsername: doc1.info.telegramUsername,
                        //     discordUsername: doc1.info.discordUsername
                        // },
                        "info.name": req.body.name,
                        "info.surname": req.body.surname,
                        "info.username": req.body.username,
                        "info.age": req.body.age,
                        "info.location": req.body.location,
                        login: req.body.username
                    }
                }, (err, doc2) => {

                    if (err) return res.status(500)

                    // db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                    //     { $set: { login: req.body.username } }, (err, doc2) => {

                    //         if (err) return res.status(500)

                    //     })

                    res.status(200).json({ msg: 'Success' })
                })
        })

    })

})


app.put('/auth/updateSecurityData', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc1) => {

        if (err) return res.status(500)

        db.collection('usersData').findOne({ email: req.body.email }, (err, doc2) => {

            if (err) return res.status(500)

            if (doc2) {
                if (doc1.info.id !== doc2.id) {
                    return res.status(409).json({ msg: "This email has already been used" })
                }
            }

            db.collection('usersData').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc3) => {

                if (err) return res.status(500)

                db.collection('usersData').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                    {
                        $set: {
                            email: req.body.email,
                            password: req.body.password || doc3.password
                        }
                    }, (err, doc4) => {

                        if (err) return res.status(500)

                        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                            {
                                $set: {
                                    email: req.body.email,
                                    // info: {
                                    //     name: doc1.info.name,
                                    //     surname: doc1.info.surname,
                                    //     username: doc1.info.username,
                                    //     email: req.body.email,
                                    //     id: doc1.info.id,
                                    //     age: doc1.info.age,
                                    //     location: doc1.info.location,
                                    //     avatar: doc1.info.avatar,
                                    //     instagramLink: doc1.info.instagramLink,
                                    //     telegramUsername: doc1.info.telegramUsername,
                                    //     discordUsername: doc1.info.discordUsername
                                    // }
                                    "info.email": req.body.email
                                }
                            }, (err, doc5) => {

                                if (err) return res.status(500)

                            })

                        res.status(200).json({ msg: 'Success' })
                    })
            })
        })
    })

})

app.put('/auth/updateAvatar', [ValidateCookies, upload.single('avatar')], async (req, res) => {

    const dimensions = sizeOf(req.file.path);

    // if (dimensions.width / dimensions.height <= 0.8 || dimensions.width / dimensions.height >= 1.1) {
    //     fs.unlink(req.file.path, (err) => {
    //         if (err) {
    //           console.error(err)
    //           return
    //         }
    //       })
    //     return res.status(400).json({msg: 'Invalid image size'})
    // }

    const result = await uploadFile(req.file)


    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc1) => {

        if (err) return res.status(500)


        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    // info: {
                    //     name: doc1.info.name,
                    //     surname: doc1.info.surname,
                    //     username: doc1.info.username,
                    //     email: doc1.info.email,
                    //     id: doc1.info.id,
                    //     age: doc1.info.age,
                    //     location: doc1.info.location,
                    //     avatar: result.Location,
                    //     instagramLink: doc1.info.instagramLink,
                    //     telegramUsername: doc1.info.telegramUsername,
                    //     discordUsername: doc1.info.discordUsername
                    // }
                    "info.avatar": result.Location
                }
            }, (err, doc2) => {

                if (err) return res.status(500)

                res.status(200).json({ msg: 'Success' })
            })
    })

})

app.delete('/auth/deleteAvatar', ValidateCookies, (req, res) => {
    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc1) => {

        if (err) return res.status(500)


        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    // info: {
                    //     name: doc1.info.name,
                    //     surname: doc1.info.surname,
                    //     username: doc1.info.username,
                    //     email: doc1.info.email,
                    //     id: doc1.info.id,
                    //     age: doc1.info.age,
                    //     location: doc1.info.location,
                    //     avatar: null,
                    //     instagramLink: doc1.info.instagramLink,
                    //     telegramUsername: doc1.info.telegramUsername,
                    //     discordUsername: doc1.info.discordUsername
                    // }
                    "info.avatar": null
                },
            }, (err, doc2) => {

                if (err) return res.status(500)

                res.status(200).json({ msg: 'Success' })
            })
    })

})


app.put('/auth/updatePersonalData', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, doc1) => {

        if (err) return res.status(500)

        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    // info: {
                    //     name: doc1.info.name,
                    //     surname: doc1.info.surname,
                    //     username: doc1.info.username,
                    //     email: doc1.info.email,
                    //     id: doc1.info.id,
                    //     age: doc1.info.age,
                    //     location: doc1.info.location,
                    //     avatar: doc1.info.avatar,
                    //     instagramLink: req.body.instagramLink,
                    //     telegramUsername: req.body.telegramUsername,
                    //     discordUsername: req.body.discordUsername
                    // },
                    "info.instagramLink": req.body.instagramLink,
                    "info.telegramUsername": req.body.telegramUsername,
                    "info.discordUsername": req.body.discordUsername

                }
            }, (err, doc2) => {

                if (err) return res.status(500)

                res.status(200).json({ msg: 'Success' })
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
                                // stats: {
                                //     totalChats: parseInt(doc3.stats.totalChats + 1),
                                //     totalMessagesSent: parseInt(doc3.stats.totalMessagesSent),
                                //     totalCharactersEntered: parseInt(doc3.stats.totalCharactersEntered)
                                // },

                                "stats.totalChats": parseInt(doc3.stats.totalChats + 1)

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
                    // stats: {
                    //     totalChats: parseInt(doc3.stats.totalChats),
                    //     totalMessagesSent: parseInt(doc3.stats.totalMessagesSent + 1),
                    //     totalCharactersEntered: parseInt(doc3.stats.totalCharactersEntered)
                    // }
                    "stats.totalMessagesSent": parseInt(doc3.stats.totalMessagesSent + 1)
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
                    // stats: {
                    //     totalChats: parseInt(doc3.stats.totalChats),
                    //     totalMessagesSent: parseInt(doc3.stats.totalMessagesSent),
                    //     totalCharactersEntered: parseInt(doc3.stats.totalCharactersEntered + 1)
                    // }
                    "stats.totalCharactersEntered": parseInt(doc3.stats.totalCharactersEntered + 1)
                }
            }, (err, doc4) => {

                if (err) return res.status(500)

                return res.status(200).json({ msg: 'Success' })

            })
    })
})


app.get('/users/get', (req, res) => {

    let count = req.query.count || 5
    let page = req.query.page || 0
    req.query.page && (page *= count, count = parseInt(count) + page)


    db.collection('users').find().toArray((err, docs) => {
        if (err) return res.status(500)
        res.json({ items: docs.slice(page, count), totalUsersCount: docs.length })
    })
})

app.get('/users/mostChats', (req, res) => {

    let count = req.query.count || 5
    let page = req.query.page || 0
    req.query.page && (page *= count, count = parseInt(count) + page)

    db.collection('users').find().toArray((err, docs) => {
        if (err) return res.status(500)
        docs.sort((a, b) => parseInt(b.stats.totalChats) - parseInt(a.stats.totalChats));
        res.json({ items: docs.slice(page, count), totalUsersCount: docs.length })
    })
})

app.get('/users/mostSentMessages', (req, res) => {

    let count = req.query.count || 5
    let page = req.query.page || 0
    req.query.page && (page *= count, count = parseInt(count) + page)

    db.collection('users').find().toArray((err, docs) => {
        if (err) return res.status(500)
        docs.sort((a, b) => parseInt(b.stats.totalMessagesSent) - parseInt(a.stats.totalMessagesSent));
        res.json({ items: docs.slice(page, count), totalUsersCount: docs.length })
    })
})

app.get('/users/mostCharactersEntered', (req, res) => {

    let count = req.query.count || 5
    let page = req.query.page || 0
    req.query.page && (page *= count, count = parseInt(count) + page)

    db.collection('users').find().toArray((err, docs) => {
        if (err) return res.status(500)
        docs.sort((a, b) => parseInt(b.stats.totalCharactersEntered) - parseInt(a.stats.totalCharactersEntered));
        res.json({ items: docs.slice(page, count), totalUsersCount: docs.length })
    })
})

app.post('/users/addFriend', ValidateCookies, (req, res) => {


    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, from) => {

        if (err) return res.status(500)

    
    db.collection('users').findOne({ id: parseInt(req.body.id) }, (err, to) => {

        if (err) return res.status(500)

        const filteredPendingArr1 = to.friends.pendingFriends.filter(e => {

            if (e.id === from.info.id) return e

        })

        if (filteredPendingArr1.length !== 0) {


            const filteredPendingArr2 = to.friends.pendingFriends.filter(e => {

                if (e.id !== parseInt(from.info.id)) return e

            })

            const filteredWaitingArr = from.friends.waitingFriends.filter(e => {

                if (e.id !== parseInt(req.body.id)) return e

            })

            to.friends.confirmedFriends.push({ id: from.info.id, username: from.info.username, avatar: from.info.avatar })

                db.collection('users').updateOne({ id: parseInt(req.body.id) },
                    {
                        $set: {
                            "friends.confirmedFriends": to.friends.confirmedFriends,
                            "friends.pendingFriends": filteredPendingArr2
                        }
                    }, (err, doc3) => {

                        if (err) return res.status(500)

                            from.friends.confirmedFriends.push({ id: req.body.id, username: req.body.username, avatar: req.body.avatar })

                            db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                                {
                                    $set: {
                                        "friends.confirmedFriends": from.friends.confirmedFriends,
                                        "friends.waitingFriends": filteredWaitingArr
                                    }
                                }, (err, doc) => {

                                    if (err) return res.status(500)

                                    res.status(200).json({ msg: 'Success' })

                                })
                        })
                   
        }

        else {

                from.friends.pendingFriends.push({ id: req.body.id, username: req.body.username, avatar: req.body.avatar })
        
                db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
                    {
                        $set: {
                            "friends.pendingFriends": from.friends.pendingFriends
                        }
                    }, (err, doc) => {
        
                        if (err) return res.status(500)
        
        
                        db.collection('users').findOne({ id: parseInt(req.body.id) }, (err, to) => {
        
                            if (err) return res.status(500)
        
                            to.friends.waitingFriends.push({ id: from.info.id, username: from.info.username, avatar: from.info.avatar })
        
                            db.collection('users').updateOne({ id: parseInt(req.body.id) },
                                {
                                    $set: {
                                        "friends.waitingFriends": to.friends.waitingFriends
                                    }
                                }, (err, doc3) => {
        
                                    if (err) return res.status(500)
        
                                    res.status(200).json({ msg: 'Success' })
                                })
                        })
                    })
        }
    })
})
})

app.post('/users/refuseOwnFriendRequest', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, from) => {

        if (err) return res.status(500)

        const filteredPendingArr = from.friends.pendingFriends.filter(e => {

            if (e.id !== parseInt(req.body.id)) return e

        })

        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    "friends.pendingFriends": filteredPendingArr
                }
            }, (err, doc) => {

                if (err) return res.status(500)


                db.collection('users').findOne({ id: parseInt(req.body.id) }, (err, to) => {

                    if (err) return res.status(500)

                    const filteredWaitingArr = to.friends.waitingFriends.filter(e => {

                        if (e.id !== parseInt(from.info.id)) return e

                    })

                    db.collection('users').updateOne({ id: parseInt(req.body.id) },
                        {
                            $set: {
                                "friends.waitingFriends": filteredWaitingArr
                            }
                        }, (err, doc2) => {

                            if (err) return res.status(500)

                            res.status(200).json({ msg: 'Success' })
                        })
                })
            })
    })
})

app.post('/users/refuseFriendRequest', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, from) => {

        if (err) return res.status(500)

        const filteredWaitingArr = from.friends.waitingFriends.filter(e => {

            if (e.id !== parseInt(req.body.id)) return e

        })

        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    "friends.waitingFriends": filteredWaitingArr
                }
            }, (err, doc) => {

                if (err) return res.status(500)


                db.collection('users').findOne({ id: parseInt(req.body.id) }, (err, to) => {

                    if (err) return res.status(500)

                    const filteredPendingArr = to.friends.pendingFriends.filter(e => {

                        if (e.id !== parseInt(from.info.id)) return e

                    })

                    db.collection('users').updateOne({ id: parseInt(req.body.id) },
                        {
                            $set: {
                                "friends.pendingFriends": filteredPendingArr
                            }
                        }, (err, doc2) => {

                            if (err) return res.status(500)

                            res.status(200).json({ msg: 'Success' })
                        })
                })
            })
    })
})


app.post('/users/confirmFriend', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, My) => {

        if (err) return res.status(500)

        const filteredWaitingArr = My.friends.waitingFriends.filter(e => {

            if (e.id !== parseInt(req.body.id)) return e

        })

        My.friends.confirmedFriends.push({ id: req.body.id, username: req.body.username, avatar: req.body.avatar })


        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    friends: {
                        confirmedFriends: My.friends.confirmedFriends,
                        pendingFriends: My.friends.pendingFriends,
                        waitingFriends: filteredWaitingArr,
                        totalFriendsCount: parseInt(My.friends.totalFriendsCount + 1)
                    }
                }
            }, (err, doc) => {

                if (err) return res.status(500)


                db.collection('users').findOne({ id: req.body.id }, (err, Their) => {

                    if (err) return res.status(500)
            
                    const filteredPendingArr = Their.friends.pendingFriends.filter(e => {
            
                        if (e.id !== parseInt(My.info.id)) return e
            
                    })
            
                    Their.friends.confirmedFriends.push({ id: My.info.id, username: My.info.username, avatar: My.info.avatar })
            
            
                    db.collection('users').updateOne({ id: req.body.id },
                        {
                            $set: {
                                friends: {
                                    confirmedFriends: Their.friends.confirmedFriends,
                                    pendingFriends: filteredPendingArr,
                                    waitingFriends: Their.friends.waitingFriends,
                                    totalFriendsCount: parseInt(Their.friends.totalFriendsCount + 1)
                                }
                            }
                        }, (err, doc) => {
            
                            if (err) return res.status(500)
            
                            res.status(200).json({ msg: 'Success' })
                        })
                })
            })
    })
})

app.delete('/users/deleteFriend/:id', ValidateCookies, (req, res) => {

    db.collection('users').findOne({ id: parseInt(req.cookies.CatTalk_userId) }, (err, My) => {

        if (err) return res.status(500)

        const myFilteredConfirmedArr = My.friends.confirmedFriends.filter(e => {

            if (e.id !== parseInt(req.params.id)) return e

        })

        db.collection('users').updateOne({ id: parseInt(req.cookies.CatTalk_userId) },
            {
                $set: {
                    "friends.confirmedFriends": myFilteredConfirmedArr,
                    "friends.totalFriendsCount": parseInt(My.friends.totalFriendsCount - 1)
                }
            }, (err, doc) => {

                if (err) return res.status(500)

                db.collection('users').findOne({ id: req.params.id }, (err, Their) => {

                    if (err) return res.status(500)
            
                    const theirFilteredConfirmedArr = Their.friends.confirmedFriends.filter(e => {
            
                        if (e.id !== My.info.id) return e
            
                    })
            
                    db.collection('users').updateOne({ id: req.params.id },
                        {
                            $set: {
                                "friends.confirmedFriends": theirFilteredConfirmedArr,
                                "friends.totalFriendsCount": parseInt(Their.friends.totalFriendsCount - 1)
                            }
                        }, (err, doc) => {
            
                            if (err) return res.status(500)
            
                            res.status(200).json({ msg: 'Success' })
                        })
                })
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