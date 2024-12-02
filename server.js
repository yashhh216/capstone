const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { LibraryBook, UserProfile, BookBorrow, BookReturn } = require('./schema');
require("dotenv").config()

const app = express();
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET;

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

const checkIfAdmin = (req, res, next) => {
    if (!req.user.admin) {
        return res.status(403).send('Admin privileges required');
    }
    next();
};
const mongo= process.env.MONGO_STRING
mongoose.connect(mongo)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Failed to connect to MongoDB:', err));


// 1. User Registration
app.post('/signup', async (req, res) => {
    try {
        const { name, username, password, email, phone } = req.body;

        const existingUser = await UserProfile.findOne({ 
            $or: [{ username }, { email }, { phone }] 
        });

        if (existingUser) {
            return res.status(400).send('Username, email, or phone already registered');
        }

        const user = new UserProfile({ 
            name, 
            username, 
            password, 
            email, 
            phone 
        });

        await user.save();
        res.status(201).send('Registration successful');
    } catch (err) {
        res.status(400).send(err.message);
    }
});


// 2. User Login
app.post('/signin', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await UserProfile.findOne({ username });

        if (!user) {
            return res.status(401).send('Invalid username or password');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).send('Invalid username or password');
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user._id, 
                username: user.username, 
                admin: user.admin 
            }, 
            SECRET_KEY, 
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            message: 'Login successful', 
            token,
            isAdmin: user.admin 
        });
    } catch (err) {
        res.status(400).send(err.message);
    }
});


// 3. Get Available Books
app.get('/library', verifyJWT, async (req, res) => {
    const availableBooks = await LibraryBook.find({ available: true });
    res.status(200).json(availableBooks);
});

// 4. Get All Users (Admin only)
app.get('/manage/users', verifyJWT, checkIfAdmin, async (req, res) => {
    const allUsers = await UserProfile.find().select('-password');
    res.status(200).json(allUsers);
});

// 5. Add a New Book (Admin only)
app.post('/library', verifyJWT, checkIfAdmin, async (req, res) => {
    try {
        const newBook = new LibraryBook(req.body);
        await newBook.save();
        res.status(201).send('New book added');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// 6. Borrow a Book
app.post('/borrow-book', verifyJWT, async (req, res) => {
    try {
        const { username, bookId } = req.body;

        if (username !== req.user.username) {
            return res.status(403).send('Unauthorized action');
        }

        const book = await LibraryBook.findById(bookId);
        if (!book || !book.available) {
            return res.status(400).send('Book is not available');
        }

        const existingBorrow = await BookBorrow.findOne({ username, bookId });
        if (existingBorrow) {
            return res.status(400).send('You have already borrowed this book');
        }

        const borrowRecord = new BookBorrow({ username, bookId });
        await borrowRecord.save();

        book.available = false;
        await book.save();

        res.status(201).send('Book borrowed successfully');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// 7. Return a Borrowed Book
app.post('/return-book', verifyJWT, async (req, res) => {
    try {
        const { username, bookId } = req.body;

        if (username !== req.user.username) {
            return res.status(403).send('Unauthorized action');
        }

        const borrowRecord = await BookBorrow.findOne({ username, bookId });
        if (!borrowRecord) {
            return res.status(400).send('No record found for this borrowed book');
        }

        const overdueFine = calculateFine(borrowRecord.duedate);

        const returnRecord = new BookReturn({ 
            username, 
            bookId, 
            duedate: borrowRecord.duedate, 
            fine: overdueFine 
        });
        await returnRecord.save();

        const book = await LibraryBook.findById(bookId);
        book.available = true;
        await book.save();

        await BookBorrow.findByIdAndDelete(borrowRecord._id);

        res.status(201).send(`Book returned successfully. Fine: $${overdueFine}`);
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// 8. Update Book Information (Admin only)
app.put('/library/:bookId', verifyJWT, checkIfAdmin, async (req, res) => {
    try {
        const updatedBook = await LibraryBook.findByIdAndUpdate(req.params.bookId, req.body, { 
            new: true,
            runValidators: true 
        });
        res.status(200).json(updatedBook);
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// Calculate Fine for Late Returns
function calculateFine(dueDate) {
    const today = new Date();
    const due = new Date(dueDate);

    if (today <= due) return 0;
    return 100;
}

app.listen(3000, () => console.log('Server running on port 3000'));