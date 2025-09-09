import AreaManagement from "@/components/AreaManagement";
import Layout from "@/components/Layout";

const Areas = () => {
  return (
    <Layout projectSelected={true}>
      <AreaManagement
        projectName="Sistema de Gestão Empresarial"
        projectSelected={true}
        initialAreas={[]} // As áreas virão do servidor Flask
      />
    </Layout>
  );
};

export default Areas;
