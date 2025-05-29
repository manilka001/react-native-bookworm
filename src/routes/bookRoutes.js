import express from 'express';
import cloudinary from '../lib/cloudinary.js';
import Book from '../models/Book.js'; 
import protectRoute from '../middleware/auth.middleware.js';

const router = express.Router();

//cretae a new book
router.post("/", protectRoute ,async (req,res) => {
    try {
        
        const {title,caption,rating,image} = req.body;

        if(!title || !caption || !rating || !image){
            return res.status(400).json({message:"Please fill all fields"});
        }

        //upload image to cloudinary
        const uploadResponse = await cloudinary.uploader.upload(image);
        const imageUrl = uploadResponse.secure_url;

        //save it to mongoDB
        const newBook = new Book({
            title,
            caption,
            rating,
            image:imageUrl,
            user:req.user._id
        });

        await newBook.save();

        res.status(201).json(newBook);

    } catch (error) {
        console.log("error in create book route",error);
        res.status(500).json({message:"Internal server error"});
    }
})

//get all books
router.get("/",protectRoute,async (req,res)=> {

    //example call from react-native-frontend
    // http://localhost:3000/api/auth/books?page=1&limit=5

    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 5;
        const skip = (page-1)*limit;

        const books = await Book.find().sort({createdAt:-1}).skip(skip).limit(limit).populate("user","username profileImage")

        const totalBooks = await Book.countDocuments();
        res.send({books,
            currentPage:page,
            totalBooks:totalBooks,
            totalPages:Math.ceil(totalBooks/limit)
        });
    } catch (error) {
        console.log("error in get all books route",error);
        res.status(500).json({message:"Internal server error"});
        
    }
})

router.get("/user",protectRoute,async (req,res) => {
    try {
        const books = await Book.find({user:req.user._id}).sort({createdAt:-1});
        res.json(books);
    } catch (error) {
        console.error("error in get user books route",error);
        res.status(500).json({message:"Internal server error"});
        
    }
})

router.delete("/:id",protectRoute,async (req,res) => {
    try {
        const book = await Book.findById(req.params.id);
        if(!book){
            return res.status(404).json({message:"Book not found"});
        }

        //check if user is the creator of the book
        if(book.user.toString() !== req.user._id.toString()){
            return res.status(403).json({message:"You are not authorized to delete this book"});
        }

        //delete image from cloudinary
        if(book.image && book.image.includes("cloudinary")) {
            try {
                const publicId = book.image.split("/").pop().split(".")[0]; // Extract public ID from URL
                await cloudinary.uploader.destroy(publicId);
            } catch (deleteError) {
                console.log("error in deleting image from cloudinary", deleteError);
                return res.status(500).json({message:"Error deleting image from cloudinary"});
                
            }
        }

        await book.deleteOne();
        res.json({message:"Book deleted successfully"});

    } catch (error) {
        console.log("error in delete book route",error);
        res.status(500).json({message:"Internal server error"});
        
    }
})
export default router;