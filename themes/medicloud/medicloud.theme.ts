// The medicloud theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in medicloud.settings.json and the generated medicloud.settings.ts;
// change them with `astryx experimental theme editor set medicloud ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {medicloudSettings} from './medicloud.settings';

export const medicloudTheme = defineTheme({
  extends: medicloudSettings,
  name: 'medicloud',
});
