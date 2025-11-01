import express from 'express';
import { startOfferScheduler } from './core/utils/offerScheduler.js';
const app:express.Express =express()

const port = 5000
 startOfferScheduler();
app.use(express.json())
// app.use(express.urlencoded({extended:true})

app.get('/',(req,res)=>{
    res.send('Hello World!')
})

app.listen(port ,()=>{
    console.log(`Server is running on port ${port}`)
})

export default app