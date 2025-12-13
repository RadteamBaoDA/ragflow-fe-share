import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import i18n from '@/locales/config';
import { useEffect, useState } from 'react';
import {
  ISearchAppDetailProps,
  useFetchSearchDetail,
} from '../../next-searches/hooks';
import { useCheckSettings, useGetSharedSearchParams } from '../hooks';
import '../index.less';
import SearchHome from '../search-home';
import SearchingPage from '../searching';
import { useSyncThemeFromParams } from '@/components/theme-provider';
import { useTranslation } from 'react-i18next';
export default function ShareSeachPage() {
  const { tenantId, locale, visibleAvatar, theme } = useGetSharedSearchParams();
  const {
    data: searchData = {
      search_config: { kb_ids: [] },
    } as unknown as ISearchAppDetailProps,
  } = useFetchSearchDetail(tenantId as string);
  const [isSearching, setIsSearching] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { openSetting: canSearch } = useCheckSettings(
    searchData as ISearchAppDetailProps,
  );
  const { t } = useTranslation();

  /**
   * Sync theme from URL parameter
   */
  useSyncThemeFromParams(theme);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);
  return (
    <>
      {visibleAvatar && (
        <div className="flex justify-start items-center gap-2 mx-6 mt-6 text-text-primary">
          {/* <RAGFlowAvatar
            className="size-6"
            avatar={searchData.avatar}
            name="ODC Knowledge Base"
          ></RAGFlowAvatar> */}
          <div>{searchData.name || t('header.search')}</div>
        </div>
      )}
      {/* <SearchingView {...searchingParam} searchData={searchData} />; */}
      {!isSearching && (
        <div className="animate-fade-in-down">
          <SearchHome
            setIsSearching={setIsSearching}
            isSearching={isSearching}
            searchText={searchText}
            setSearchText={setSearchText}
            canSearch={!canSearch}
          />
        </div>
      )}
      {isSearching && (
        <div className="animate-fade-in-up">
          <SearchingPage
            setIsSearching={setIsSearching}
            searchText={searchText}
            setSearchText={setSearchText}
            data={searchData as ISearchAppDetailProps}
          />
        </div>
      )}
    </>
  );
}
