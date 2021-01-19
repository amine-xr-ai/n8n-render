import {
	BINARY_ENCODING,
	IExecuteFunctions,
} from 'n8n-core';

import {
	IBinaryKeyData,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import {
	SIGNL4ApiRequest,
} from './GenericFunctions';

export class Signl4 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SIGNL4',
		name: 'signl4',
		icon: 'file:signl4.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume SIGNL4 API.',
		defaults: {
			name: 'SIGNL4',
			color: '#53afe8',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'signl4Api',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Alert',
						value: 'alert',
					},
				],
				default: 'alert',
				description: 'The resource to operate on.',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: [
							'alert',
						],
					},
				},
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send an alert',
					},
					{
						name: 'Resolve',
						value: 'resolve',
						description: 'Resolve an alert',
					},
				],
				default: 'send',
				description: 'The operation to perform.',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '',
				required: false,
				displayOptions: {
					show: {
						operation: [
							'send',
						],
						resource: [
							'alert',
						],
					},
				},
				description: 'A more detailed description for the alert.',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						operation: [
							'send',
						],
						resource: [
							'alert',
						],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Alerting Scenario',
						name: 'alertingScenario',
						type: 'options',
						options: [
							{
								name: 'Single ACK',
								value: 'single_ack',
								description: 'In case only one person needs to confirm this Signl.',
							},
							{
								name: 'Multi ACK',
								value: 'multi_ack',
								description: 'in case this alert must be confirmed by the number of people who are on duty at the time this Singl is raised',
							},
						],
						default: 'single_ack',
						required: false,
					},
					{
						displayName: 'Attachments',
						name: 'attachmentsUi',
						placeholder: 'Add Attachments',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: false,
						},
						options: [
							{
								name: 'attachmentsBinary',
								displayName: 'Attachments Binary',
								values: [
									{
										displayName: 'Property Name',
										name: 'property',
										type: 'string',
										placeholder: 'data',
										default: '',
										description: 'Name of the binary properties which contain data which should be added as attachment',
									},
								],
							},
						],
						default: {},
					},
					{
						displayName: 'External ID',
						name: 'externalId',
						type: 'string',
						default: '',
						description: `If the event originates from a record in a 3rd party system, use this parameter to pass <br/>
						the unique ID of that record. That ID will be communicated in outbound webhook notifications from SIGNL4,<br/>
						which is great for correlation/synchronization of that record with the alert.<br/>
						If you resolve / close an alert you must use the same External ID as in the original alert.`,
					},
					{
						displayName: 'Filtering',
						name: 'filtering',
						type: 'boolean',
						default: 'false',
						description: `Specify a boolean value of true or false to apply event filtering for this event, or not. <br/>
						If set to true, the event will only trigger a notification to the team, if it contains at least one keyword <br/>
						from one of your services and system categories (i.e. it is whitelisted)`,
					},
					{
						displayName: 'Location',
						name: 'locationFieldsUi',
						type: 'fixedCollection',
						placeholder: 'Add Location',
						default: {},
						description: 'Transmit location information (\'latitude, longitude\') with your event and display a map in the mobile app.',
						options: [
							{
								name: 'locationFieldsValues',
								displayName: 'Location',
								values: [
									{
										displayName: 'Latitude',
										name: 'latitude',
										type: 'string',
										required: true,
										description: 'The location latitude.',
										default: '',
									},
									{
										displayName: 'Longitude',
										name: 'longitude',
										type: 'string',
										required: true,
										description: 'The location longitude.',
										default: '',
									},
								],
							},
						],
					},
					{
						displayName: 'Service',
						name: 'service',
						type: 'string',
						default: '',
						description: 'Assigns the alert to the service/system category with the specified name.',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'The title or subject of this alert.',
					},
				],
			},
			{
				displayName: 'External ID',
				name: 'externalId',
				type: 'string',
				default: '',
				required: false,
				displayOptions: {
					show: {
						operation: [
							'resolve',
						],
						resource: [
							'alert',
						],
					},
				},
				description: `If the event originates from a record in a 3rd party system, use this parameter to pass <br/>
				the unique ID of that record. That ID will be communicated in outbound webhook notifications from SIGNL4,<br/>
				which is great for correlation/synchronization of that record with the alert.<br/>
				If you resolve / close an alert you must use the same External ID as in the original alert.`,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = (items.length as unknown) as number;
		const qs: IDataObject = {};
		let responseData;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		for (let i = 0; i < length; i++) {
			if (resource === 'alert') {
				//https://connect.signl4.com/webhook/docs/index.html
				// Send alert
				if (operation === 'send') {
					const message = this.getNodeParameter('message', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields',i) as IDataObject;
					
					let data = "";

					// Message
					data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
					data += "Content-Disposition: form-data; name=\"message\"\r\n\r\n";
					data += message + "\r\n";

					// Title
					if (additionalFields.title) {
						data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
						data += "Content-Disposition: form-data; name=\"title\"\r\n\r\n";
						data += additionalFields.title as string + "\r\n";
					}

					// X-S4-Service
					if (additionalFields.service) {
						data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
						data += "Content-Disposition: form-data; name=\"X-S4-Service\"\r\n\r\n";
						data += additionalFields.service as string + "\r\n";
					}

					// X-S4-Location
					if (additionalFields.locationFieldsUi) {
						const locationUi = (additionalFields.locationFieldsUi as IDataObject).locationFieldsValues as IDataObject;
						if (locationUi) {
							data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
							data += "Content-Disposition: form-data; name=\"X-S4-Location\"\r\n\r\n";
							data += `${locationUi.latitude},${locationUi.longitude}` + "\r\n";
						}
					}

					// X-S4-AlertingScenario
					if (additionalFields.alertingScenario) {
						data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
						data += "Content-Disposition: form-data; name=\"X-S4-AlertingScenario\"\r\n\r\n";
						data += additionalFields.alertingScenario as string + "\r\n";
					}

					// X-S4-Filtering
					if (additionalFields.filtering) {
						data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
						data += "Content-Disposition: form-data; name=\"X-S4-Filtering\"\r\n\r\n";
						data += (additionalFields.filtering as boolean).toString() + "\r\n";
					}

					// X-S4-ExternalID
					if (additionalFields.externalId) {
						data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
						data += "Content-Disposition: form-data; name=\"X-S4-ExternalID\"\r\n\r\n";
						data += additionalFields.externalId as string + "\r\n";
					}

					// Status
					data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
					data += "Content-Disposition: form-data; name=\"X-S4-Status\"\r\n\r\n";
					data += "new\r\n";

					// Source System
					data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
					data += "Content-Disposition: form-data; name=\"X-S4-SourceSystem\"\r\n\r\n";
					data += "n8n\r\n";

					// Attachments
					const attachments = additionalFields.attachmentsUi as IDataObject;
					if (attachments) {
						if (attachments.attachmentsBinary && items[i].binary) {

							const propertyName = (attachments.attachmentsBinary as IDataObject).property as string;

							const binaryProperty = (items[i].binary as IBinaryKeyData)[propertyName];

							if (binaryProperty) {

								const supportedFileExtension = ['png', 'jpg', 'bmp', 'gif', 'mp3', 'wav'];

								if (!supportedFileExtension.includes(binaryProperty.fileExtension as string)) {

									throw new Error(`Invalid extension, just ${supportedFileExtension.join(',')} are supported}`);
								}

								data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513\r\n";
								data += "Content-Disposition: form-data; name=\"" + binaryProperty.fileName + "\"; filename=\"" + binaryProperty.fileName + "\"\r\n";
								data += "Content-Type: " + binaryProperty.mimeType + "\r\n";
								data += "Content-Transfer-Encoding: base64\r\n\r\n";

								data += Buffer.from(binaryProperty.data, 'base64').toString('base64') + "\r\n";

							} else {
								throw new Error(`Binary property ${propertyName} does not exist on input`);
							}
						}
					}
					
					data += "------Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513--\r\n";

					const credentials = this.getCredentials('signl4Api');

					const teamSecret = credentials?.teamSecret as string;

					responseData = await SIGNL4ApiRequest.call(
						this,
						'POST',
						'multipart/form-data; boundary=----Boundary-cc2050af-c42f-4cda-a0c3-ede7eaa89513',
						data,
						{},
						teamSecret,
						{},
					);
				}
				// Resolve alert
				if (operation === 'resolve') {

					const data: IDataObject = {};

					data['X-S4-ExternalID'] = this.getNodeParameter('externalId', i) as string;

					data['X-S4-Status'] = 'resolved';
					
					// Source system
					data['X-S4-SourceSystem'] = 'n8n';

					const credentials = this.getCredentials('signl4Api');

					const teamSecret = credentials?.teamSecret as string;

					responseData = await SIGNL4ApiRequest.call(
						this,
						'POST',
						'application/json',
						JSON.stringify(data),
						{},
						teamSecret,
						{},
					);
				}
			}
		}
		if (Array.isArray(responseData)) {
			returnData.push.apply(returnData, responseData as IDataObject[]);
		} else if (responseData !== undefined) {
			returnData.push(responseData as IDataObject);
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
