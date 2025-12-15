const User = require("../models/User");

const sendNotification = async() =>{
    try {
        const {sender_id, receiver_id, notification_title, issue_type, vehicle_id, order_id, message} = req.body
    } catch (error) {
        
    }
}

module.exports = {sendNotification}