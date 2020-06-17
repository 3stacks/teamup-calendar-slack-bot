import { APIGatewayProxyHandler } from 'aws-lambda';
import axios, { AxiosResponse } from 'axios';
import format from 'date-fns/format';
import uniq from 'lodash/uniq';
import 'source-map-support/register';
import { sendMessage } from './utils';

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
}

interface IResponseData {
    events: IEvent[];
    timestamp: number;
}

interface IEventList {
    [key: string]: IEvent[];
}

export const sendEvents: APIGatewayProxyHandler = async (_, _context) => {
    const response: AxiosResponse<IResponseData> = await axios.get(
        `https://api.teamup.com/${process.env.CALENDAR_ID}/events`,
        {
            headers: {
                'Teamup-Token': process.env.TEAMUP_TOKEN,
            },
        }
    );

    const events = response.data.events;

    if (!events.length) {
        console.info('no events today');

        try {
            const response = await sendMessage([
                'No events today 😴'
            ]);

            return {
                statusCode: 200,
                body: JSON.stringify(response.data),
            };
        } catch (e) {
            return {
                statusCode: 500,
                body: 'Failed to send message to slack channel',
            };
        }
    }

    console.info('events found:', JSON.stringify(events, null, '\t'));

    const subCalendars: Promise<ISubCalendarResponse>[] = uniq(
        events.map(event => event.subcalendar_id)
    ).map(
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

    const text = await Promise.all(subCalendars).then(subCalendarList => {
        console.info(
            'subCalendars found',
            JSON.stringify(subCalendarList, null, '\t')
        );

        const eventList: IEventList = events.reduce((acc, curr) => {
            const subCalendarEvents = acc[curr.subcalendar_id];

            if (subCalendarEvents) {
                return {
                    ...acc,
                    [curr.subcalendar_id]: [...subCalendarEvents, curr],
                };
            }

            acc[curr.subcalendar_id] = [curr];

            return acc;
        }, {});

        return Object.entries(eventList).reduce(
            (acc, [subCalendarId, events]) => {
                acc.push(
                    `*${
                        subCalendarList.find(
                            subCalendar =>
                                subCalendar.id === parseInt(subCalendarId, 10)
                        ).name
                    }*`
                );

                const eventLines = events.map(({ who, location, title }) => {
                    return `- ${who ? `*${who}* is ` : ``}*${title}*${
                        location ? ` at *${location}*` : ''
                    }`;
                });

                return [...acc, ...eventLines, '\n'];
            },
            [
                `*Events for today (${format(
                    new Date(events[0].start_dt),
                    "EEEE', the' do 'of' LLL"
                )})*\n`,
            ]
        );
    });

    if (!text) {
        console.info('no text generated');
        return {
            statusCode: 200,
            body: 'Success',
        };
    }

    console.info(`text generated: \n${text}`);

    try {
        const response = await sendMessage(text);

        return {
            statusCode: 200,
            body: JSON.stringify(response.data),
        };
    } catch (e) {
        return {
            statusCode: 500,
            body: 'Failed to send message to slack channel',
        };
    }
};
