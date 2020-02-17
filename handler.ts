import { APIGatewayProxyHandler } from 'aws-lambda';
import axios, { AxiosResponse } from 'axios';
import uniq from 'lodash/uniq';
import 'source-map-support/register';

interface IEvent {
    id: '626228484';
    series_id: null;
    remote_id: null;
    subcalendar_id: number;
    subcalendar_ids: number[];
    all_day: boolean;
    rrule: string;
    title: string;
    who: string;
    location: string;
    notes: null;
    version: string;
    readonly: boolean;
    tz: null;
    start_dt: string;
    end_dt: string;
    ristart_dt: null;
    rsstart_dt: null;
    creation_dt: string;
    update_dt: null;
    delete_dt: null;
    custom: {};
}

interface ISubCalendarResponse {
    subcalendar: {
        id: number;
        name: string;
        active: boolean;
        color: number;
        overlap: boolean;
        type: number;
        attributes: string[];
        creation_dt: string;
        update_dt: string;
        readonly: boolean;
    };
}

interface IResponseData {
    events: IEvent[];
    timestamp: number;
}

interface IEventList {
    [key: string]: IEvent[];
}

export const hello: APIGatewayProxyHandler = async (event, _context) => {
    const response = await axios.get(
        `https://api.teamup.com/${process.env.CALENDAR_ID}/events`,
        {
            headers: {
                'Teamup-Token': process.env.TEAMUP_TOKEN,
            },
        }
    );

    const events = response.data.events;

    if (!events.length) {
        return {
            statusCode: 200,
            body: 'Success',
        };
    }

    console.log(events)
    const subCalendars = uniq(events.map(event => event.subcalendar_id)).map(
        calenderId =>
            new Promise(resolve => {
                axios
                    .get(
                        `https://api.teamup.com/${process.env.CALENDAR_ID}/subcalendars/${calenderId}`,
                        {
                            headers: {
                                'Teamup-Token': process.env.TEAMUP_TOKEN,
                            },
                        }
                    )
                    .then(response => resolve(response.data.subcalendar));
            })
    );
    console.log(subCalendars);

    const text = Promise.all(subCalendars).then(subCalendarList => {
        return Object.entries(events).reduce((acc, [subCalendarId, events]) => {
            return (
                acc +
                `
        ## ${
            subCalendarList.find(subCalendar => subCalendar.id === subCalendarId)
                .name
        }
        
        ${events
            .map(({ title, who, location }) => {
                return `- ${who} is ${title}${
                    location ? ` at ${location}` : ''
                }`;
            })
            .join('\n')}
      `);
        }, '');
    });

    console.log(await text);

    await axios.get(
        `https://slack.com/api/chat.postMessage?token=${process.env.SLACK_TOKEN}&channel=${process.env.CHANNEL_NAME}&text=${text}`
    );

    return {
        statusCode: 200,
        body: 'Success',
    };
};
