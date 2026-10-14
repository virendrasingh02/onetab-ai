import { Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface HubSpotAuth extends Record<string, string> {
  token: string;
}

const CONTACT_PROPS = ['email', 'firstname', 'lastname', 'phone', 'company', 'lifecyclestage', 'createdate'];
const DEAL_PROPS = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate'];

const compact = (o: any) => ({ id: o.id, ...o.properties, updatedAt: o.updatedAt });

/** HubSpot CRM through a private-app access token (Settings → Integrations → Private Apps). */
@Injectable()
export class HubSpotProvider extends RestConnector<HubSpotAuth> {
  readonly providerId = 'HUBSPOT';
  protected readonly app = 'HubSpot';
  protected readonly requiredFields = ['token'] as const;
  protected readonly secrets = ['token'];

  protected capabilities() {
    return {
      displayName: 'HubSpot',
      description: 'CRM contacts, companies and deals — look up, create and update records from an agent.',
      category: 'CRM',
      connectorCategory: 'crm',
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'crm.objects.contacts.read', description: 'Read contacts and deals', required: true },
        { scope: 'crm.objects.contacts.write', description: 'Create and update contacts and deals (each asks for approval)' },
      ],
      credentialFields: [
        {
          key: 'token',
          label: 'Private app access token',
          secret: true,
          help: 'HubSpot → Settings → Integrations → Private Apps → create an app with the CRM contacts and deals scopes.',
        },
      ],
    };
  }

  protected target(auth: HubSpotAuth) {
    return { baseUrl: 'https://api.hubapi.com', headers: { Authorization: `Bearer ${auth.token}` } };
  }

  protected async ping(_auth: HubSpotAuth, call: RestCall) {
    await call('GET', '/crm/v3/objects/contacts', { params: { limit: 1 } });
    return { label: 'private app token accepted' };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      { id: 'new_contact', label: 'New contact', description: 'Starts the agent for each new contact.', pollActionId: 'search_contacts', itemsPath: 'contacts', idField: 'id' },
      { id: 'new_deal', label: 'New deal', description: 'Starts the agent for each new deal.', pollActionId: 'search_deals', itemsPath: 'deals', idField: 'id' },
    ];
  }

  protected actions(): RestAction<HubSpotAuth>[] {
    const search = (object: 'contacts' | 'deals', properties: string[], key: 'contacts' | 'deals') =>
      async ({ input, call }: { input: Record<string, unknown>; call: RestCall }) => {
        const query = textOf(input['query']);
        const data = await call('POST', `/crm/v3/objects/${object}/search`, {
          data: {
            ...(query ? { query } : {}),
            limit: boundedInt(input['limit'], 20, 1, 100),
            properties,
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
          },
        });
        const items = ((data.results ?? []) as any[]).map(compact);
        return { message: `Found ${items.length} ${object}.`, data: { [key]: items, total: data.total ?? items.length } };
      };
    const searchProps = { query: str('Text to search for (name, email, company). Empty = newest first.'), limit: num('Max results (default 20).') };

    return [
      action({ id: 'search_contacts', label: 'Search contacts', description: 'Find contacts by text, newest first.', level: 'read', properties: searchProps }, search('contacts', CONTACT_PROPS, 'contacts')),
      action({ id: 'search_deals', label: 'Search deals', description: 'Find deals by text, newest first.', level: 'read', properties: searchProps }, search('deals', DEAL_PROPS, 'deals')),
      action(
        { id: 'get_contact', label: 'Get contact', description: 'Fetch one contact by id.', level: 'read', properties: { contactId: str('The contact id.') }, required: ['contactId'] },
        async ({ input, call }) => {
          const { contactId } = requireText(input, 'contactId');
          const data = await call('GET', `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`, { params: { properties: CONTACT_PROPS.join(',') } });
          return { message: 'Fetched the contact.', data: { contact: compact(data) } };
        },
      ),
      action(
        {
          id: 'create_contact',
          label: 'Create contact',
          description: 'Add a contact to the CRM.',
          level: 'write',
          properties: { email: str('Email address.'), firstname: str('First name.'), lastname: str('Last name.'), phone: str('Phone.'), company: str('Company name.') },
          required: ['email'],
        },
        async ({ input, call }) => {
          const { email } = requireText(input, 'email');
          const data = await call('POST', '/crm/v3/objects/contacts', {
            data: { properties: compactObject({ email, firstname: textOf(input['firstname']), lastname: textOf(input['lastname']), phone: textOf(input['phone']), company: textOf(input['company']) }) },
          });
          return { message: `Created contact ${email}.`, data: { contact: compact(data) } };
        },
      ),
      action(
        {
          id: 'update_contact',
          label: 'Update contact',
          description: 'Change fields on an existing contact. Only the fields given are changed.',
          level: 'write',
          properties: { contactId: str('The contact id.'), email: str('Email.'), firstname: str('First name.'), lastname: str('Last name.'), phone: str('Phone.'), company: str('Company.'), lifecyclestage: str('Lifecycle stage, e.g. lead, customer.') },
          required: ['contactId'],
        },
        async ({ input, call }) => {
          const { contactId } = requireText(input, 'contactId');
          const properties = compactObject(Object.fromEntries(['email', 'firstname', 'lastname', 'phone', 'company', 'lifecyclestage'].map((k) => [k, textOf(input[k])])));
          const data = await call('PATCH', `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`, { data: { properties } });
          return { message: 'Updated the contact.', data: { contact: compact(data) } };
        },
      ),
      action(
        {
          id: 'create_deal',
          label: 'Create deal',
          description: 'Open a new deal.',
          level: 'write',
          properties: { dealname: str('Deal name.'), amount: str('Deal amount.'), dealstage: str('Stage id in your pipeline (e.g. appointmentscheduled).'), pipeline: str('Pipeline id (default pipeline if empty).') },
          required: ['dealname'],
        },
        async ({ input, call }) => {
          const { dealname } = requireText(input, 'dealname');
          const data = await call('POST', '/crm/v3/objects/deals', {
            data: { properties: compactObject({ dealname, amount: textOf(input['amount']), dealstage: textOf(input['dealstage']), pipeline: textOf(input['pipeline']) }) },
          });
          return { message: `Created deal ${dealname}.`, data: { deal: compact(data) } };
        },
      ),
    ];
  }
}
