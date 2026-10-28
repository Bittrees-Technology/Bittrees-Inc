import {createUserSyncHandler,kvTransport} from '../server/usersync/session.mjs';
const transport=kvTransport();
export default createUserSyncHandler({origin:'https://gov.bittrees.org',prefix:'bittrees:usersync:',...transport});
