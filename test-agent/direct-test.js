const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const FLOWISE_ENDPOINT = 'https://app.c1elly.ai/api/v1/prediction/5f1fa57c-e6fd-463c-ac6e-c73fd5fb578b';
const sessionId = uuidv4();

async function sendMessage(msg) {
    console.log('\n>>> USER:', msg);
    try {
        const response = await axios.post(FLOWISE_ENDPOINT, {
            question: msg,
            overrideConfig: { sessionId }
        }, { timeout: 60000 });

        const text = response.data.text || response.data.answer || response.data.response || JSON.stringify(response.data);
        console.log('<<< BOT:', text.substring(0, 500));

        // Check for error patterns
        if (/error|sorry|cannot|unable|failed|problem/i.test(text)) {
            console.log('⚠️  ERROR PATTERN DETECTED!');
        }

        return text;
    } catch (error) {
        console.log('❌ API ERROR:', error.message);
        return null;
    }
}

async function runTest() {
    console.log('=== Direct Flowise Test ===');
    console.log('Session:', sessionId);

    // Simplified flow to get to the slot selection step
    await sendMessage('Hi I need to schedule an orthodontic appointment for my child');
    await sendMessage('My name is Sarah Johnson and my phone number is 2155551234');
    await sendMessage('S A R A H   J O H N S O N');
    await sendMessage('Just one child');
    await sendMessage('Yes this is a new patient consult');
    await sendMessage('No my child has never been to your office before');
    await sendMessage('No they have never had braces or orthodontic treatment');
    await sendMessage('Her name is Emma Johnson');
    await sendMessage('J O H N S O N. Her birthday is March 15, 2014');
    await sendMessage('She has Keystone First insurance');
    await sendMessage('No special needs');
    await sendMessage('My email is sarah@email.com. Morning appointments work best');
    await sendMessage('Yes that time works for me');
    await sendMessage('No thats all, thank you');

    console.log('\n=== Test Complete ===');
}

runTest().catch(console.error);
