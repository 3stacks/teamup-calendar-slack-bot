import axios from 'axios';

export async function sendMessage(text: string[]): Promise<any> {
    const response = await axios.post(
        process.env.SLACK_WEBHOOK_URL,
        {
            body: text.join('\n')
        },
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
    console.log(response);

    return response;
}
