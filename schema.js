const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const bookSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    author: { 
        type: String, 
        required: true,
        trim: true
    },
    genre: { 
        type: String, 
        required: true
    },
    type: { 
        type: String, 
        required: true
    },
    available: { 
        type: Boolean, 
        default: true 
    },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    username: { 
        type: String, 
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
    },
    email: { 
        type: String, 
        required: true,
        unique: true,
        lowercase: true
    },
    phone: { 
        type: String, 
        required: true,
        unique: true,
        match: /^[0-9]{10}$/
    },
    admin: { 
        type: Boolean, 
        default: false 
    },
});

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const borrowSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true 
    },
    bookId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'LibraryBook',
        required: true
    },
    duedate: { 
        type: Date, 
        default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        required: true
    },
}, { timestamps: true });

const returnSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true 
    },
    bookId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'LibraryBook',
        required: true
    },
    duedate: { 
        type: Date, 
        required: true
    },
    fine: { 
        type: Number, 
        required: true 
    }
}, { timestamps: true });

const LibraryBook = mongoose.model('LibraryBook', bookSchema);
const UserProfile = mongoose.model('UserProfile', userSchema);
const BookBorrow = mongoose.model('BookBorrow', borrowSchema);
const BookReturn = mongoose.model('BookReturn', returnSchema);

module.exports = { LibraryBook, UserProfile, BookBorrow, BookReturn };