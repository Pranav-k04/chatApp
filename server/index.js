import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = 'Admin'
const app = express()

app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})

//state
const UsersState = {
    users:[],
    setUsers:function (newUsersArray) {
        this.users=newUsersArray
    }
}


const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:63342", "http://127.0.0.1:63342"]
    }
})

io.on('connection', socket => {
    console.log(`User ${socket.id} connected`)
    // Upon connection - only to user
    socket.emit('message', buildMsg(ADMIN, "Welcome to Chat App !"))
    //user joining a room
    socket.on('enterRoom',({name,room})=> {
        //leave prvs rooms
        const prevRoom = getUser(socket.id)?.room
        if (prevRoom){
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message',buildMsg(ADMIN,`${name} has left the room`))
        }
        const user = activateUser(socket.id,name,room)
     //cannot update prvs room users list until after state update in active user
        if(prevRoom){
            io.to(prevRoom).emit('userList',{
                users:getUsersInRoom(prevRoom)
            })
        }
        socket.join(user.room)
        //to user who joins
        socket.emit('message',buildMsg(ADMIN,`You have joined the ${user.room} Chat room! `))
        //to evy1 else
        socket.broadcast.to(user.room).emit('message',buildMsg((ADMIN),`${user.name} has joined the room`))
        //Update user list for room
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })
        //update room list for everyone
        io.emit('roomList',{
            rooms:getAllActiveRooms()
        })
    })
    //user disconnecting from room
    socket.on('disconnect',()=>{

        const user = getUser(socket.id)
        userLeavesApp(socket.id)
        if (user){
            io.to(user.room).emit('message',buildMsg('ADMIN',`${user.name} has left the room`))
            io.to(user.room).emit('userList',{
                users:getUsersInRoom(user.room)
            })
            io.emit('roomList',{
                rooms:getAllActiveRooms()
            })
        }
        console.log(`User ${socket.id} disconnected`)

    })
    // Listening for a message event
    socket.on('message', ({name,text}) => {
        const room = getUser(socket.id)?.room
        io.to(room).emit('message',buildMsg(name,text))
    })

    // Listen for activity
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if(room){
            socket.broadcast.to(room).emit('activity',name)
        }

    })
})


function buildMsg(name,text) {
    return {
        name,
        text,
        time:new Intl.DateTimeFormat('default',{
        hour:'numeric',
        minute:"numeric",
        second:'numeric'
        }).format(new Date())
    }
}

//User functions
function activateUser(id, name, room) {
    const user = { id, name, room };
    UsersState.setUsers([
        ...UsersState.users.filter(u => u.id !== id),
        user
    ]);
    return user;
}

function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(u => u.id !== id)
    );
}

function getUser(id) {
    return UsersState.users.find(u => u.id === id);
}

function getUsersInRoom(room) {
    return UsersState.users.filter(u => u.room === room);
}

function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(u => u.room)));
}