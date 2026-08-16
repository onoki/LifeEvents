import { handleIndexHistoryRequest } from './_index-history-core.js';

export default {
  fetch(request) {
    return handleIndexHistoryRequest(request);
  },
};
