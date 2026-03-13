const Concern = require("../models/concern.model");
const User = require("../models/User");



// CREATE CONCERN

exports.raiseConcern = async (req,res)=>{

    try{
    
    const {
    name,
    phoneNumber,
    category,
    issueDescription
    } = req.body;
    
    
    // check registered user
    
    const user = await User.findOne({ phoneNumber: phoneNumber });
    
    if(!user){
    
    return res.status(400).json({
    success:false,
    message:"You are not registered user"
    });
    
    }
    
    
    const concern = new Concern({
    
    user_id:user._id,
    name,
    phoneNumber,
    category,
    issueDescription,
    incidentProof:req.body.incidentProof || []
    
    });
    
    await concern.save();
    
    
    return res.status(201).json({
    success:true,
    message:`Concern raised successfully. Your ticket id is ${concern._id}`,
    ticketId:concern._id,
    data:concern
    });
    
    }catch(error){
    
    res.status(500).json({
    success:false,
    error:error.message
    });
    
    }
    
};

// DELETE CONCERN

exports.deleteConcern = async (req,res)=>{

    try{
    
    const { ids } = req.body;
    
    
    // delete multiple
    
    if(ids && ids.length > 0){
    
    await Concern.deleteMany({
    _id: { $in: ids }
    });
    
    return res.json({
    success:true,
    message:"Concerns deleted successfully"
    });
    
    }
    
    
    // delete single
    
    const { id } = req.params;
    
    const concern = await Concern.findByIdAndDelete(id);
    
    if(!concern){
    
    return res.status(404).json({
    success:false,
    message:"Concern not found"
    });
    
    }
    
    res.json({
    success:true,
    message:"Concern deleted successfully"
    });
    
    }catch(error){
    
    res.status(500).json({
    success:false,
    error:error.message
    });
    
    }
    
};

// GET CONCERNS

exports.getConcerns = async (req,res)=>{

try{

const {category,status,phoneNumber} = req.query;

let filter={};

if(category) filter.category=category;
if(status) filter.status=status;
if(phoneNumber) filter.phoneNumber=phoneNumber;

const concerns = await Concern
.find(filter)
.sort({createdAt:-1})
.populate("user_id","name phoneNumber");

res.json({

success:true,
total:concerns.length,
data:concerns

});

}catch(error){

res.status(500).json({
success:false,
error:error.message
});

}

};




// ADD MESSAGE IN CONVERSATION

exports.addConversation = async (req,res)=>{

try{

const {id} = req.params;

const {sender,message} = req.body;

const concern = await Concern.findByIdAndUpdate(

id,

{
$push:{
conversation:{
sender,
message
}
}
},

{new:true}

);

res.json({
success:true,
data:concern
});

}catch(error){

res.status(500).json({
success:false,
error:error.message
});

}

};




// UPDATE STATUS

exports.updateStatus = async (req,res)=>{

try{

const {id} = req.params;
const {status} = req.body;

const concern = await Concern.findByIdAndUpdate(

id,
{status},
{new:true}

);

res.json({
success:true,
data:concern
});

}catch(error){

res.status(500).json({
success:false,
error:error.message
});

}

};