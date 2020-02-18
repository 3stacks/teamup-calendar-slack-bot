import axios from 'axios';

export async function sendMessage(text: string[]): Promise<any> {
    const response = await axios.post(
        `https://slack.com/api/chat.postMessage`,
        {
            channel: process.env.CHANNEL_NAME,
            blocks: text.map(t => ({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: t,
                },
            })),
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
                'Content-Type': 'application/json',
            },
        }
    );
    console.log(response);

    return response;
}
